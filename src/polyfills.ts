// Polyfills for serverless Node.js environments (pdfjs-dist / canvas / DOM)
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-expect-error polyfill for serverless runtime
  globalThis.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    multiply() { return this; }
    inverse() { return this; }
    translate() { return this; }
    scale() { return this; }
    transformPoint(point?: { x?: number; y?: number }) {
      return { x: point?.x ?? 0, y: point?.y ?? 0, z: 0, w: 1 };
    }
  };
}

if (typeof globalThis.ImageData === 'undefined') {
  // @ts-expect-error polyfill for serverless runtime
  globalThis.ImageData = class ImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
      this.data = new Uint8ClampedArray(w * h * 4);
    }
  };
}

if (typeof globalThis.Path2D === 'undefined') {
  // @ts-expect-error polyfill for serverless runtime
  globalThis.Path2D = class Path2D {};
}

export {};
