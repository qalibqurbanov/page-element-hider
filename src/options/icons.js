/**
 * Small stroke icons (24x24 grid, Feather-style) for the settings page.
 * Paths are static constants - never built from user data.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const ICON_PATHS = Object.freeze({
  edit: ['M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'],
  // Two bins, one in front of the other: "delete many".
  'trash-stack': [
    'M10 4.5h12', 'M13 4.5V3a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 19 3v1.5', 'M20.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-5',
    'M2.5 9.5h13', 'M5.5 9.5V8A1.5 1.5 0 0 1 7 6.5h3A1.5 1.5 0 0 1 11.5 8v1.5', 'M13.5 9.5v11a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-11', 'M7.5 13v5', 'M10.5 13v5',
  ],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
});

/** @param {keyof typeof ICON_PATHS} name @returns {SVGSVGElement} */
export function icon(name, size = 16) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICON_PATHS[name]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
