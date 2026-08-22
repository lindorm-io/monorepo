/**
 * How ONE header parameter's VALUE is represented on the COSE wire — the per-wire
 * half of the registry's codec column, and the twin of {@link HeaderCodec}.
 *
 * A CLOSED union, so both COSE passes (`token-header.ts#wireHeaderToCoseMap` on
 * write, `header/cose-wire-header.ts` on read) switch over it exhaustively with a
 * `never` default, and neither carries its own list of parameter names.
 *
 *   - `"passthrough"` the CBOR value IS the JOSE value (cty, typ, x5u, oid).
 *   - `"algorithmLabel"` an integer COSE algorithm label against the JOSE
 *                        algorithm NAME (alg, RFC 9052 §3.1).
 *   - `"textBytes"` a CBOR `bstr` against utf-8 text (kid).
 *   - `"base64Bytes"` a CBOR `bstr` against a base64url string (iv).
 *   - `"critical"` the `crit` array whose MEMBERS are labels in their own right
 *                  (RFC 9052 §1.5), remapped in both directions.
 *   - `"certChain"` RFC 9360 §2 `COSE_X509` — `bstr / [ 2*certs: bstr ]` of DER
 *                   bytes — against JOSE's `Array<base64>` (x5c).
 *   - `"certHash"` RFC 9360 §2 `COSE_CertHash` — `[ hashAlg, hashValue ]` —
 *                  against a base64url digest string (x5t#S256).
 */
export type CoseHeaderCodec =
  | { kind: "passthrough" }
  | { kind: "algorithmLabel" }
  | { kind: "textBytes" }
  | { kind: "base64Bytes" }
  | { kind: "critical" }
  | { kind: "certChain" }
  | { kind: "certHash" };
