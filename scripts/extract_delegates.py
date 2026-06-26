"""Extract delegate records (position, name, contact) per constituency from the
local "constituency conference" dataset and write apps/web/lib/delegates.local.json.

Deep extraction: anchors on (position + phone). Any text unit (table row or line)
that contains both a recognisable position and a phone number is treated as a
delegate; the name is the best-effort remainder (kept even when the source typed
it without spaces). The goal is to capture every number, across the many formats
in the dataset (inline "*Pos* - Name (024 310 8820)", NAME/POSITION/CONTACT
columns, PDF tables with concatenated names, wrapped phones, etc.).

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

# Position canonicalisation — order matters (deputy/vice variants first; the bare
# "chair" pattern must stay last so "Zongo Caucus Chairman" classifies correctly).
POSITION_PATTERNS = [
    (r"vice[\s-]*chair(?:man|person)?", "Vice Chairman"),
    (r"(?:deputy|dep\.?)\s*secretary", "Deputy Secretary"),
    (r"(?:deputy|dep\.?)\s*treasurer", "Deputy Treasurer"),
    (r"(?:deputy|dep\.?)\s*(?:women'?s?)\s*organi[sz]er", "Deputy Women's Organizer"),
    (r"(?:deputy|dep\.?)\s*youth\s*organi[sz]er", "Deputy Youth Organizer"),
    (r"(?:deputy|dep\.?)\s*nasara", "Deputy Nasara Coordinator"),
    (r"(?:deputy|dep\.?)\s*organi[sz]er", "Deputy Organizer"),
    (r"(?:deputy|dep\.?)\s*comm\w*", "Deputy Communications Officer"),
    (r"(?:women'?s?)\s*organi[sz]er", "Women's Organizer"),
    (r"youth\s*organi[sz]er", "Youth Organizer"),
    (r"nasara\s*(coordinator|organi[sz]er|coordinater)", "Nasara Coordinator"),
    (r"comm\w*\s*officer", "Communications Officer"),
    (r"\borgani[sz]er\b", "Organizer"),
    (r"\bsecretary\b", "Secretary"),
    (r"\btreasurer\b", "Treasurer"),
    (r"zongo\s*caucus(?:\s*chair(?:man|person)?)?", "Zongo Caucus"),
    (r"executive\s*member", "Executive Member"),
    (r"council\s*(?:of\s*elders|member)", "Council of Elders"),
    (r"\bchair(?:man|person)?\b", "Chairman"),
]
POSITION_RE = [(re.compile(p, re.I), c) for p, c in POSITION_PATTERNS]

# Phone normalisation: collapse spaces/dots/dashes inside a 0XXXXXXXXX number so
# "024 310 8820" and "024.310.8820" become "0243108820".
PHONE_COMPRESS = re.compile(r"0(?:[ .\-]?\d){9}(?!\d)")
def normalize_phones(text: str) -> str:
    return PHONE_COMPRESS.sub(lambda m: re.sub(r"[ .\-]", "", m.group(0)), text)

PHONE_RE = re.compile(r"(?<!\d)(0\d{9})(?!\d)")
def first_phone(text: str):
    m = PHONE_RE.search(text)
    return m.group(1) if m else None

# Words that are never part of a personal name (stripped when cleaning a name).
JUNK_WORDS = re.compile(
    r"\b(elected|unopposed|votes?|contesting|positions?|portfolios?|numbers?|members?|"
    r"caucus|zongo|executive|council|elders|telephone|contact|name|no|nan|none|"
    r"constituency|congress|democratic|national|deputy|dep|asst|assistant|officer|"
    r"vice|new|old)\b",
    re.I,
)

def canon_position(text):
    for rx, canon in POSITION_RE:
        if rx.search(text):
            return canon
    return None

def clean_name(text):
    # Strip ID/party codes, phone digits and serials (e.g. "F200060091", "0243...").
    s = re.sub(r"\b[A-Za-z]{0,2}\d{3,}[\w./-]*", " ", text)
    for rx, _ in POSITION_RE:
        s = rx.sub(" ", s)
    s = JUNK_WORDS.sub(" ", s)
    s = re.sub(r"[^A-Za-z.'\- ]", " ", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" .-'")
    return s if len(s) >= 2 else ""

# A plausible personal name (allows a single concatenated token like "PROSPERAKAMANI").
NON_NAME = re.compile(r"position|contact|telephone|number|officer|name of|s/?n|^no$|elected", re.I)
def is_name(t):
    t = (t or "").strip()
    if not (3 <= len(t) <= 45) or NON_NAME.search(t):
        return False
    toks = [w for w in t.split() if w]
    if not (1 <= len(toks) <= 6):
        return False
    if not all(re.match(r"^[A-Za-z][A-Za-z.'\-]*$", w) for w in toks):
        return False
    if len(toks) == 1 and len(toks[0]) < 5:  # a lone short word is probably junk
        return False
    return True

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
    lines = []
    for p in root.iter(W + "p"):
        txt = "".join(t.text or "" for t in p.iter(W + "t")).strip()
        if txt:
            lines.append(txt)
    return tables, lines

def _xlsx_cell(c):
    if c is None:
        return ""
    s = str(c).strip()
    # Excel often stores a phone as a number, dropping the leading 0: "540377751.0".
    m = re.fullmatch(r"(\d{9,10})\.0", s)
    if m:
        d = m.group(1)
        if len(d) == 9:
            return "0" + d
        if len(d) == 10 and d[0] == "0":
            return d
    return s

def xlsx_tables(path):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows = []
    for ws in wb.worksheets:
        for r in ws.iter_rows(values_only=True):
            rows.append([_xlsx_cell(c) for c in r])
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
# Lines that end on a wrapped position fragment (e.g. "Communication" / "Officer").
FRAG_RE = re.compile(r"(communication|deputy|women|youth|nasara|council of|dep\.?|vice|other)\s*$", re.I)

def merge_fragments(lines):
    out, i = [], 0
    while i < len(lines):
        cur = lines[i]
        while FRAG_RE.search(cur) and i + 1 < len(lines):
            i += 1
            cur = cur + " " + lines[i]
        out.append(cur)
        i += 1
    return out

def from_units(units, require_phone=True):
    """State machine over text units. A delegate is emitted when we have a
    position plus a phone (same unit or paired across wrapped units). For
    structured tables (require_phone=False) a position + a clear name also counts
    even when the phone column is blank. Names are kept even if concatenated."""
    out = []
    pend = None  # {"pos", "name", "phone"}

    def emit(pos, name, phone):
        out.append({"position": pos, "name": title_name(name) if name else "", "contact": phone})

    def flush():
        nonlocal pend
        if pend and pend["pos"] and (pend["phone"] or (not require_phone and is_name(pend["name"]))):
            emit(pend["pos"], pend["name"], pend["phone"])
        pend = None

    for raw in units:
        u = normalize_phones(raw)
        pos = canon_position(u)
        phone = first_phone(u)
        name = clean_name(u)
        if pos and phone:
            flush()
            emit(pos, name, phone)
        elif pos and not require_phone and is_name(name):
            flush()
            emit(pos, name, None)  # structured row with a name but no phone column
        elif pos:
            flush()
            pend = {"pos": pos, "name": name, "phone": None}
        elif phone:
            if pend and pend["pos"]:
                pend["phone"] = phone
                if not pend["name"] and name:
                    pend["name"] = name
                flush()
        elif name and pend and not pend["name"]:
            pend["name"] = name
    flush()
    return out

def units_from_tables(tables):
    units = []
    for rows in tables:
        for cells in rows:
            joined = " ".join(c for c in cells if c).strip()
            if joined:
                units.append(joined)
    return units

def dedupe(dels):
    seen, out = set(), []
    for d in dels:
        key = (d["position"], d["name"], d["contact"])
        if key in seen:
            continue
        seen.add(key)
        out.append(d)
    return out

# --- combined single-document regions (Bono, Upper West) -----------------------
POS_BREAK = re.compile(
    r"(?=(?:Chairman|Vice\s*Chair|Secretary|Deputy|Treasurer|Organi[sz]er|Communication|"
    r"Women|Youth|Nasara|Council|Zongo|Executive))",
    re.I,
)

def blob_to_lines(seg):
    return [x for x in POS_BREAK.sub("\n", seg).splitlines() if x.strip()]

UPPER_WEST_ANCHORS = {
    "WA CENTRAL": "Wa Central", "WA EAST": "Wa East", "WA WEST": "Wa West", "JIRAPA": "Jirapa",
    "LAWRA": "Lawra", "LAMBUSSIE": "Lambussie Karni", "NANDOM": "Nandom",
    "SISSALA WEST": "Sissala West", "SISSALA EAST": "Sissala East",
    "NADOWLI": "Nadowli Kaleo", "DBI": "Daffiama Bussie Issa", "DAFFIAMA": "Daffiama Bussie Issa",
}
BONO_ANCHORS = {
    "SUNYANI EAST": "Sunyani East", "SUNYANI WEST": "Sunyani West", "BEREKUM EAST": "Berekum East",
    "BEREKUM WEST": "Berekum West", "DORMAA CENTRAL": "Dormaa Central", "DORMAA EAST": "Dormaa East",
    "DORMAA WEST": "Dormaa West", "JAMAN NORTH": "Jaman North", "JAMAN SOUTH": "Jaman South",
    "BANDA": "Banda", "TAIN": "Tain", "WENCHI": "Wenchi",
}

BONO_ROW = re.compile(r"([A-Z][A-Z.]+(?:\s+[A-Z][A-Z.]+){0,3})\s+ELECTED\s+([A-Z]+(?:\s+[A-Z]+)?)\s+(0\d{9})")

def parse_combined(text, anchors):
    text = re.sub(r"\s+", " ", text)  # collapse runs of spaces so anchors match (e.g. "DORMAA  WEST")
    keys = sorted(anchors, key=len, reverse=True)
    rx = re.compile(r"(" + "|".join(re.escape(k) for k in keys) + r")")
    parts = rx.split(text)
    out = {}
    current = None
    for piece in parts:
        up = piece.strip().upper()
        if up in anchors:
            current = anchors[up]
            out.setdefault(current, [])
            continue
        if not current:
            continue
        dels = []
        if "ELECTED" in piece:  # Bono style: NAME ELECTED POSITION PHONE
            for nm, pos_raw, phone in BONO_ROW.findall(normalize_phones(piece)):
                pos = canon_position(pos_raw)
                if pos:
                    dels.append({"position": pos, "name": title_name(clean_name(nm)), "contact": phone})
        # Always also try the generic parser, keep whichever is richer.
        alt = from_units(blob_to_lines(piece))
        if len(alt) > len(dels):
            dels = alt
        out[current].extend(dels)
    return {k: dedupe(v) for k, v in out.items() if v}

def read_any_text(path, ext):
    if ext == "docx":
        root = ET.fromstring(zipfile.ZipFile(path).read("word/document.xml"))
        return " ".join(t.text or "" for t in root.iter(W + "t"))
    if ext == "pdf" and pypdf:
        return " ".join((pg.extract_text() or "") for pg in pypdf.PdfReader(path).pages)
    return ""

def main():
    result = {}
    stats = {"files": 0, "with_delegates": 0, "delegates": 0, "by_ext": {}, "empty": []}
    for region_dir in sorted(os.listdir(SRC)):
        full = os.path.join(SRC, region_dir)
        if not os.path.isdir(full):
            continue
        region = REGION_META.get(region_dir, region_dir.title())

        anchors = UPPER_WEST_ANCHORS if region_dir == "UPPER WEST" else BONO_ANCHORS if region_dir == "BONO" else None
        if anchors:
            for fn in sorted(os.listdir(full)):
                if fn.startswith("~$") or not os.path.isfile(os.path.join(full, fn)):
                    continue
                ext = fn.rsplit(".", 1)[-1].lower()
                stats["files"] += 1
                stats["by_ext"][ext] = stats["by_ext"].get(ext, 0) + 1
                try:
                    parsed = parse_combined(read_any_text(os.path.join(full, fn), ext), anchors)
                except Exception:
                    parsed = {}
                for con, dels in parsed.items():
                    stats["with_delegates"] += 1
                    stats["delegates"] += len(dels)
                    result[f"{region}::{con.lower()}"] = {"region": region, "constituency": con, "delegates": dels}
            continue

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
            dels_t = from_units(units_from_tables(tables), require_phone=False)
            dels_x = from_units(merge_fragments(lines), require_phone=True)
            dels = dels_t if len(dels_t) >= len(dels_x) else dels_x
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
