// Click-to-open definition popover for `.glossary-link` spans (see glossary.ts).
// Delegated so it works for markup rendered at any time by any view.

import { GLOSSARY } from '../glossary';

let popover: HTMLDivElement | null = null;

function ensure(): HTMLDivElement {
  if (!popover) {
    popover = document.createElement('div');
    popover.className = 'glossary-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Definition');
    document.body.appendChild(popover);
  }
  return popover;
}

function hide(): void {
  popover?.classList.remove('visible');
}

function show(anchor: Element, key: string): void {
  const entry = GLOSSARY[key];
  if (!entry) return;
  const el = ensure();
  el.innerHTML = `
    <button class="glossary-close" type="button" aria-label="Close definition">×</button>
    <h4>${entry.term}</h4>
    <p class="glossary-short">${entry.short}</p>
    <p>${entry.definition}</p>
  `;
  el.classList.add('visible');

  // Position under the anchor, nudged to stay on screen. Measured after the
  // class is applied so the popover has its real size.
  const a = anchor.getBoundingClientRect();
  const p = el.getBoundingClientRect();
  const pad = 10;
  let left = a.left;
  if (left + p.width + pad > window.innerWidth) left = window.innerWidth - p.width - pad;
  left = Math.max(pad, left);
  let top = a.bottom + 8;
  if (top + p.height + pad > window.innerHeight) top = Math.max(pad, a.top - p.height - 8);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.querySelector('.glossary-close')?.addEventListener('click', hide);
}

export function initGlossary(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    if (target?.closest('.glossary-popover')) return;
    const link = target?.closest?.('.glossary-link') as HTMLElement | null;
    if (!link) {
      hide();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const key = link.dataset.term;
    if (key) show(link, key);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
    const link = (e.target as Element | null)?.closest?.('.glossary-link') as HTMLElement | null;
    if (link && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (link.dataset.term) show(link, link.dataset.term);
    }
  });
  window.addEventListener('resize', hide);
}
