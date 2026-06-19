"""Extract delegate records (position, name, contact) per constituency from the
local "constituency conference" dataset and write apps/web/lib/delegates.local.json.

That output is GITIGNORED — it contains PII (names + phone numbers) and must never
be committed. The app reads it at runtime on the server only.

Run from repo root:  python scripts/extract_delegates.py
"""
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET

import openpyxl
try:
    import pypdf
except Exception:
    pypdf = None

SRC = "constituency conference"
OUT = "apps/web/lib/delegates.local.json"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

REGION_META = {
    "AHAFO": "Ahafo", "ASHANTI": "Ashanti", "BONO": "Bono", "BONO EAST": "Bono East",
    "CENTRAL": "Central", "EASTERN REGION": "Eastern", "GAR": "Greater Accra",
    "NORTH EAST": "North East", "NORTHERN REGION": "Northern", "OTI": "Oti",
    "SAVANNA": "Savannah", "UPPER EAST": "Upper East", "UPPER WEST": "Upper West",
    "VOLTA": "Volta", "WESTERN": "Western", "WESTRN NORTH": "Western North",
}

SUFFIX_RE = re.compile(
    r"[\s-]+(?:ahafo|ashanti|bono east|bono|central|eastern|accra|gar|north east|"
    r"northern|oti|savanna(?:h)?|upper east|upper west|volta|western north|western)\s*$",
    re.I,
)

def clean_constituency(filename: str) -> str:
    n = re.sub(r"\.[^.]+$", "", filename)
    n = re.sub(r"[–—]", "-", n)
    n = SUFFIX_RE.sub("", n)
    n = re.sub(r"[\s-]+$", "", n)
    n = re.sub(r"\s{2,}", " ", n).strip()
    return " ".join(w[:1].upper() + w[1:].lower() if w else w for w in n.split(" "))

# Position canonicalisation — order matters (deputy/vice variants first).
POSITION_PATTERNS = [
    (r"vice\s*chair", "Vice Chairman"),
    (r"deputy\s*secretary", "Deputy Secretary"),
    (r"deputy\s*treasurer", "Deputy Treasurer"),
    (r"deputy\s*(women'?s?)\s*organi[sz]er", "Deputy Women's Organizer"),
    (r"deputy\s*youth\s*organi[sz]er", "Deputy Youth Organizer"),
    (r"deputy\s*nasara", "Deputy Nasara Coordinator"),
    (r"deputy\s*organi[sz]er", "Deputy Organizer"),
    (r"deputy\s*comm", "Deputy Communications Officer"),
    (r"(women'?s?)\s*organi[sz]er", "Women's Organizer"),
    (r"youth\s*organi[sz]er", "Youth Organizer"),
    (r"nasara\s*(coordinator|organi[sz]er|coordinater)", "Nasara Coordinator"),
    (r"comm\w*\s*officer", "Communications Officer"),
    (r"\borgani[sz]er\b", "Organizer"),
    (r"\bsecretary\b", "Secretary"),
    (r"\btreasurer\b", "Treasurer"),
    (r"council\s*of\s*elders", "Council of Elders"),
    (r"\bchair(man|person)?\b", "Chairman"),
]
POSITION_RE = [(re.compile(p, re.I), c) for p, c in POSITION_PATTERNS]

PHONE_RE = re.compile(r"(?<!\d)(0\d{9})(?!\d)")
NON_NAME = re.compile(
    r"elected|unopposed|votes|position|^name$|constituency|region|^no$|s/?no|contact|"
    r"telephone|phone|number|chairman|secretary|treasurer|organi|nasara|officer|"
    r"national|democratic|congress|executive|deputy|vice|women|youth|elders|^\d",
    re.I,
)

def canon_position(text):
    for rx, canon in POSITION_RE:
        if rx.search(text):
            return canon
    return None

def is_name(text):
    t = text.strip()
    if not (4 <= len(t) <= 40):
        return False
    if NON_NAME.search(t):
        return False
    tokens = [w for w in re.split(r"\s+", t) if w]
    if not (2 <= len(tokens) <= 5):
        return False
    return all(re.match(r"^[A-Za-z][A-Za-z.'\-]*$", w) for w in tokens)

def phone_in(text):
    m = PHONE_RE.search(re.sub(r"[\s-]", "", text))
    return m.group(1) if m else None

def title_name(s):
    return " ".join(w.capitalize() for w in s.split())

# ---- format readers ----------------------------------------------------------
def docx_tables_and_text(path):
    root = ET.fromstring(zipfile.ZipFile(path).read("word/document.xml"))
    tables = []
    for tbl in root.iter(W + "tbl"):
        rows = []
        for tr in tbl.iter(W + "tr"):
            cells = [" ".join(t.text or "" for t in tc.iter(W + "t")).strip() for tc in tr.iter(W + "tc")]
            rows.append(cells)
        tables.append(rows)
    # plain text grouped into lines by paragraph
    lines = []
    for p in root.iter(W + "p"):
        txt = "".join(t.text or "" for t in p.iter(W + "t")).strip()
        if txt:
            lines.append(txt)
    return tables, lines

def xlsx_tables(path):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows = []
    for ws in wb.worksheets:
        for r in ws.iter_rows(values_only=True):
            rows.append(["" if c is None else str(c).strip() for c in r])
    return [rows], []

def pdf_lines(path):
    if not pypdf:
        return [], []
    try:
        reader = pypdf.PdfReader(path)
        lines = []
        for page in reader.pages:
            lines += [ln.strip() for ln in (page.extract_text() or "").splitlines() if ln.strip()]
        return [], lines
    except Exception:
        return [], []

# ---- delegate parsing --------------------------------------------------------
def from_tables(tables):
    out = []
    for rows in tables:
        for cells in rows:
            joined = " ".join(cells)
            pos = None
            for c in cells:
                pos = canon_position(c)
                if pos:
                    break
            if not pos:
                continue
            name = next((c for c in cells if is_name(c)), None)
            if not name:
                continue
            out.append({"position": pos, "name": title_name(name), "contact": phone_in(joined)})
    return out

def from_lines(lines):
    out = []
    for ln in lines:
        pos = canon_position(ln)
        if not pos:
            continue
        phone = phone_in(ln)
        # strip position words + phone, keep the rest as candidate name
        rest = PHONE_RE.sub("", re.sub(r"[\s-]", " ", ln))
        for rx, _ in POSITION_RE:
            rest = rx.sub(" ", rest)
        rest = re.sub(r"[^A-Za-z.'\- ]", " ", rest)
        rest = re.sub(r"\s{2,}", " ", rest).strip()
        if is_name(rest):
            out.append({"position": pos, "name": title_name(rest), "contact": phone})
    return out

def dedupe(dels):
    seen, out = set(), []
    for d in dels:
        key = (d["position"], d["name"])
        if key in seen:
            continue
        seen.add(key)
        out.append(d)
    return out

def main():
    result = {}
    stats = {"files": 0, "with_delegates": 0, "delegates": 0, "by_ext": {}, "empty": []}
    for region_dir in sorted(os.listdir(SRC)):
        full = os.path.join(SRC, region_dir)
        if not os.path.isdir(full):
            continue
        region = REGION_META.get(region_dir, region_dir.title())
        for fn in sorted(os.listdir(full)):
            if fn.startswith("~$"):
                continue
            path = os.path.join(full, fn)
            if not os.path.isfile(path):
                continue
            ext = fn.rsplit(".", 1)[-1].lower()
            con = clean_constituency(fn)
            if not con or "complete" in con.lower():
                continue
            stats["files"] += 1
            stats["by_ext"][ext] = stats["by_ext"].get(ext, 0) + 1
            try:
                if ext == "docx":
                    tables, lines = docx_tables_and_text(path)
                elif ext == "xlsx":
                    tables, lines = xlsx_tables(path)
                elif ext == "pdf":
                    tables, lines = pdf_lines(path)
                else:
                    tables, lines = [], []
            except Exception:
                tables, lines = [], []
            dels = from_tables(tables)
            if len(dels) < 3:  # tables thin -> try text
                dels = dels or from_lines(lines)
            dels = dedupe(dels)
            key = f"{region}::{con.lower()}"
            if dels:
                stats["with_delegates"] += 1
                stats["delegates"] += len(dels)
                result[key] = {"region": region, "constituency": con, "delegates": dels}
            else:
                stats["empty"].append(f"{region}/{con} ({ext})")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=0)

    print(f"Wrote {OUT}")
    print(f"Files processed: {stats['files']}  by ext: {stats['by_ext']}")
    print(f"Constituencies with delegates: {stats['with_delegates']}  total delegates: {stats['delegates']}")
    print(f"No delegates extracted ({len(stats['empty'])}):")
    for e in stats["empty"][:40]:
        print("  -", e)

if __name__ == "__main__":
    main()
