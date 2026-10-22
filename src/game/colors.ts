export function hexAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return `rgba(255,255,255,${alpha})`;
  const channels = [0, 2, 4].map(i => parseInt(expanded.slice(i, i + 2), 16));
  return `rgba(${channels.join(',')},${alpha})`;
}