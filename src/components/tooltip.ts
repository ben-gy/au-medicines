// Global hover tooltip driven by [data-tip] attributes anywhere in the document.
// Canonical factory pattern (patterns/tooltip.ts) — works for SVG and HTML marks
// alike. Native SVG <title> is not an acceptable substitute.
//
// `data-tip` may contain newlines; they render as line breaks.
let tip: HTMLDivElement | null = null;

function ensure(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'hover-tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  return tip;
}

function position(el: HTMLDivElement, x: number, y: number): void {
  const pad = 12;
  const rect = el.getBoundingClientRect();
  let left = x + 14;
  let top = y + 14;
  if (left + rect.width + pad > window.innerWidth) left = x - rect.width - 14;
  if (top + rect.height + pad > window.innerHeight) top = y - rect.height - 14;
  el.style.left = `${Math.max(pad, left)}px`;
  el.style.top = `${Math.max(pad, top)}px`;
}

function render(el: HTMLDivElement, text: string): void {
  el.innerHTML = '';
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) el.appendChild(document.createElement('br'));
    // First line is the mark's name; the rest are values.
    const span = document.createElement('span');
    if (i === 0) span.className = 'hover-tip-title';
    span.textContent = line;
    el.appendChild(span);
  });
}

export function initTooltip(): void {
  let activeText = '';
  document.addEventListener('mouseover', (e) => {
    const target = (e.target as Element)?.closest?.('[data-tip]');
    if (!target) return;
    const text = target.getAttribute('data-tip') ?? '';
    if (!text) return;
    activeText = text;
    const el = ensure();
    render(el, text);
    el.classList.add('visible');
    position(el, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
  });
  document.addEventListener('mousemove', (e) => {
    if (!tip || !tip.classList.contains('visible')) return;
    const target = (e.target as Element)?.closest?.('[data-tip]');
    if (!target || target.getAttribute('data-tip') !== activeText) {
      tip.classList.remove('visible');
      return;
    }
    position(tip, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
  });
  document.addEventListener('mouseout', (e) => {
    const target = (e.target as Element)?.closest?.('[data-tip]');
    if (target && tip) tip.classList.remove('visible');
  });
  // A tooltip left visible under a scrolled-away mark is a ghost. The same
  // happens after a click that opens a panel over the mark: the pointer never
  // moves, so no mouseout fires and the tooltip floats on top of the new panel.
  window.addEventListener('scroll', () => tip?.classList.remove('visible'), true);
  document.addEventListener('click', () => tip?.classList.remove('visible'), true);
}
