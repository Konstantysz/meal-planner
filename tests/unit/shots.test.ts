import { describe, it, expect } from 'vitest';
import { shotName } from '../../scripts/shots';

describe('shotName', () => {
  it('names a screenshot after route, width and scheme', () => {
    expect(shotName('/plan', 390, 'light')).toBe('plan-390-light.png');
    expect(shotName('/recipes/abc-1', 1280, 'dark')).toBe('recipes-abc-1-1280-dark.png');
    expect(shotName('/', 390, 'dark')).toBe('home-390-dark.png');
  });
});
