// Minimal ambient types for `apca-w3` (the package ships no bundled .d.ts).
declare module 'apca-w3' {
  /** Convert an sRGB [r,g,b] (0–255) triple to APCA screen luminance Y. */
  export function sRGBtoY(rgb: [number, number, number]): number;
  /** APCA Lc for text luminance against background luminance (signed). */
  export function APCAcontrast(txtY: number, bgY: number): number;
}
