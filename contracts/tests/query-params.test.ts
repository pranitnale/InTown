import { describe, it, expect } from 'vitest';
import { CoordinateParam, BBoxParam } from '../api/index.ts';

/**
 * Query-param coercion guards (§5.5). GET params arrive as flat strings, so the
 * `"lat,lng"` / `"minLng,minLat,maxLng,maxLat"` transforms must reject malformed
 * shapes BEFORE parsing — otherwise `Number('') === 0` would silently coerce a
 * bare comma into a valid all-zero coordinate / bounding box.
 */

describe('CoordinateParam', () => {
  it('parses a well-formed "lat,lng"', () => {
    expect(CoordinateParam.parse('48.8584,2.2945')).toEqual({ lat: 48.8584, lng: 2.2945 });
    expect(CoordinateParam.parse('-1,-2')).toEqual({ lat: -1, lng: -2 });
    expect(CoordinateParam.parse('0,0')).toEqual({ lat: 0, lng: 0 });
  });

  it.each([
    ['empty components', ','],
    ['trailing comma', '48.8584,'],
    ['leading comma', ',2.2945'],
    ['non-numeric', 'foo,bar'],
    ['too few components', '48.8584'],
    ['too many components', '48.8584,2.2945,3'],
    ['whitespace', '48.8584, 2.2945'],
    ['empty string', ''],
  ])('rejects malformed input (%s)', (_label, input) => {
    expect(CoordinateParam.safeParse(input).success).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(CoordinateParam.safeParse('91,0').success).toBe(false);
    expect(CoordinateParam.safeParse('0,181').success).toBe(false);
  });
});

describe('BBoxParam', () => {
  it('parses a well-formed "minLng,minLat,maxLng,maxLat"', () => {
    expect(BBoxParam.parse('2.22,48.81,2.47,48.90')).toEqual({
      min_lng: 2.22,
      min_lat: 48.81,
      max_lng: 2.47,
      max_lat: 48.9,
    });
  });

  it.each([
    ['all-empty components', ',,,'],
    ['trailing comma', '2.22,48.81,2.47,'],
    ['non-numeric', 'a,b,c,d'],
    ['too few components', '2.22,48.81,2.47'],
    ['too many components', '2.22,48.81,2.47,48.90,1'],
    ['whitespace', '2.22, 48.81, 2.47, 48.90'],
    ['empty string', ''],
  ])('rejects malformed input (%s)', (_label, input) => {
    expect(BBoxParam.safeParse(input).success).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(BBoxParam.safeParse('181,0,0,0').success).toBe(false);
  });
});
