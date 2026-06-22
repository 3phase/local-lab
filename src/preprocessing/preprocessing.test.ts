import { describe, expect, it } from 'vitest';
import { fitScaler, scale } from './StandardScaler';
import { fitOneHot, oneHot } from './OneHotEncoder';
import { fitLabels } from './LabelEncoder';

describe('preprocessing', () => {
  it('scales values and imputes missing with zero', () => {
    const s = fitScaler('x', [1, 2, 3, null]);
    expect(scale(2, s)).toBeCloseTo(0);
    expect(scale(null, s)).toBeCloseTo(0)
  });
  it('encodes categories and unknowns', () => {
    const e = fitOneHot('c', ['a', 'a', 'b', 'c'], 2);
    expect(e.includeOtherBucket).toBe(true);
    expect(oneHot('new', e).reduce((a, b) => a + b, 0)).toBe(1)
  });
  it('creates stable sorted labels', () => expect(fitLabels(['z', 'a', 'z']).labels).toEqual(['a', 'z']))
})
