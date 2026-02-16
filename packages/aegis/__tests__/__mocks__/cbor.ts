// ESM bridge for the cbor package (which is CJS-only).
// Jest ESM mode cannot resolve named exports from CJS modules,
// so we load cbor via createRequire and re-export its members.
//
// We require the cbor entry point by absolute file path to avoid
// the moduleNameMapper (which maps "^cbor$" to this very file).

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const cbor = require("/Users/jonn/Projects/lindorm-monorepo/node_modules/cbor/lib/cbor.js");

export const encode = cbor.encode;
export const decode = cbor.decode;
export const decodeFirst = cbor.decodeFirst;
export const Encoder = cbor.Encoder;
export const Decoder = cbor.Decoder;
