export function Nav() {
  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
      <a className="flex items-center gap-2 font-semibold" href="#inicio">
        <span className="grid size-9 place-items-center rounded-xl bg-[#14532d] text-lg text-white">R</span>
        Radar Precio
      </a>
      <span className="text-sm text-[#4b6358]">Colombia · compra con contexto</span>
    </nav>
  );
}
