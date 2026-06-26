// Login side panel: the NDC "Operations Excellence" creative (public/logo2.jpg).
// The artwork is square and the panel is tall, so we use object-contain over a
// matching navy background — the whole image stays intact (logo, headline and the
// three pillars are never cropped) and the margins blend into the panel.
//
// To swap the image, drop a replacement at apps/web/public/ and update the src.
export function BrandPanel() {
  return (
    <div className="relative hidden bg-[#0a1b3e] md:block">
      <img
        src="/logo2.jpg"
        alt="NDC — Operations Excellence: Driven by Service. Powered by Purpose."
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}
