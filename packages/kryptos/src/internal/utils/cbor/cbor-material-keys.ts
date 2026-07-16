import type { KryptosJwk } from "../../../types/index.js";

// JWK members whose value is raw key material: base64url text in the JWK, a raw
// CBOR byte string on the wire. Everything else is an enum, scalar, or free text.
export const CBOR_MATERIAL_KEYS = [
  "x",
  "y",
  "d",
  "n",
  "e",
  "p",
  "q",
  "dp",
  "dq",
  "qi",
  "k",
  "pub",
  "priv",
] as const satisfies ReadonlyArray<keyof KryptosJwk>;
