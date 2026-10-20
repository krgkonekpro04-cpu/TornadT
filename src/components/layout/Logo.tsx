import tornadoLogo from "../../../favicon.svg";

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <img src={tornadoLogo} className={`${className} shrink-0 rounded-xl`} alt="" aria-hidden="true" />
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" data-testid="tornadt-logo">
      <LogoMark />
      {!collapsed && (
        <div className="leading-none">
          <div className="font-heading text-lg font-bold tracking-tight text-tt-text">
            Tornad<span className="text-tt-accent">T</span>
          </div>
          <div className="mt-1 text-[10px] tracking-wide text-tt-muted">Track the Storm.</div>
        </div>
      )}
    </div>
  );
}
