export default function PortalAuthAmbient() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0c0c0c] via-black to-[#080808]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_15%_35%,rgba(129,1,0,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_85%_75%,rgba(255,255,255,0.04),transparent_50%)]" />
      <div className="absolute -left-[20%] top-[10%] h-[50vh] w-[50vh] rounded-full bg-[#810100]/[0.06] blur-[100px]" />
    </div>
  );
}
