// Dependency-free SVG bar chart. Refuses to draw when there is no real data.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function barChartSVG(spec, title) {
  if (!spec || !spec.data.length) return null;
  const W = 640, row = 38, top = 44, left = 190, H = top + spec.data.length * row + 16;
  const max = Math.max(...spec.data.map(d => d.value));
  const bars = spec.data.map((d, i) => {
    const y = top + i * row, w = Math.max(4, Math.round((d.value / max) * (W - left - 60)));
    return `<text x="${W - 12}" y="${y + 20}" text-anchor="end" font-size="14">${esc(d.label)}</text>` +
      `<rect x="${W - left - w}" y="${y + 4}" width="${w}" height="22" rx="4" fill="#1f6feb"/>` +
      `<text x="${W - left - w - 8}" y="${y + 21}" text-anchor="end" font-size="14" font-weight="700">${d.value}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="max-width:100%;height:auto;display:block;margin:0 auto" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" font-family="Cairo,sans-serif">` +
    `<rect width="${W}" height="${H}" fill="#fff"/><text x="${W - 12}" y="26" text-anchor="end" font-size="16" font-weight="700">${esc(title)}</text>${bars}</svg>`;
}
