import { expect, it } from 'vitest';
import { hexAlpha } from './colors';

it('parses the counter aura shorthand without invalid color channels', () => {
  expect(hexAlpha('#9ad', 0.4)).toBe('rgba(153,170,221,0.4)');
});