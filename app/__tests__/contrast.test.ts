import { darkColors, lightColors, type ColorRoles } from '../src/design/tokens';

/** WCAG 2.x relative luminance / contrast ratio. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

// Risk: color tokens (some sampled from the reference, some derived) must still give readable text.
// Text pairs need >= 4.5:1 (WCAG AA body text). Non-text UI (borders, accents) needs >= 3:1.
const textPairs: [keyof ColorRoles, keyof ColorRoles, string][] = [
  ['onSurface', 'surface', 'body on surface'],
  ['onSurface', 'surfaceContainer', 'text on cards'],
  ['onSurface', 'surfaceContainerHigh', 'text on bars'],
  ['onSurfaceVariant', 'surface', 'secondary text on surface'],
  ['onSurfaceVariant', 'surfaceContainer', 'secondary text on cards'],
  ['onSurfaceVariant', 'surfaceContainerHigh', 'secondary text on header'],
  ['onSurfaceVariant', 'surfaceVariant', 'chip text'],
  ['primary', 'surface', 'primary text/links on sheet'],
  ['primary', 'surfaceContainerHigh', 'primary title on header'],
  ['onPrimary', 'primary', 'button label'],
  ['onSecondaryContainer', 'secondaryContainer', 'selected chip / nav'],
  ['onPrimaryContainer', 'primaryContainer', 'banner text'],
  ['onErrorContainer', 'errorContainer', 'error text'],
  ['error', 'surface', 'overdue section heading'],
  ['inverseOnSurface', 'inverseSurface', 'snackbar text'],
];

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('%s theme contrast', (_name, c) => {
  it.each(textPairs)('%s on %s (%s) >= 4.5:1', (fg, bg) => {
    expect(ratio(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it('priority accents are distinguishable from the card (>= 3:1) and from each other', () => {
    for (const p of ['priorityHigh', 'priorityMedium', 'priorityLow'] as const) {
      expect(ratio(c[p], c.surfaceContainer)).toBeGreaterThanOrEqual(3);
    }
    const ps = new Set([c.priorityHigh, c.priorityMedium, c.priorityLow]);
    expect(ps.size).toBe(3);
  });
  it('outline for inputs and chips is visible (>= 3:1) against its surface', () => {
    expect(ratio(c.outline, c.surface)).toBeGreaterThanOrEqual(3);
  });
});
