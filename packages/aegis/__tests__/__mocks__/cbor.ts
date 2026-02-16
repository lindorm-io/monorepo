// Mock for cbor package — not needed by JWT/JWE interop tests.
// Required because jest ESM mode resolves the full aegis src module graph,
// which includes CweKit/CwsKit/CwtKit that import cbor.

export const encode = (): Buffer => Buffer.alloc(0);
export const decode = (): unknown => ({});
export const decodeFirst = (): unknown => ({});
export const Encoder = class {};
export const Decoder = class {};
