/**
 * The `aegis.encrypt` result (§5e) — the confidentiality counterpart of the
 * signed `SignedJwt`. `aegis.encrypt` produces an encrypted outer format (a JWE
 * or a COSE_Encrypt0), so the only surface is the `format` discriminant plus the
 * wire token; there are NO domain claims on the WRITE side (the caller supplied
 * them). The read counterpart is {@link DecryptedToken}.
 */
export type EncryptedToken = {
  format: "jwe" | "cwe";
  token: string;
};
