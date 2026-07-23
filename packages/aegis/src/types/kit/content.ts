import type { Dict } from "@lindorm/types";

/**
 * The DECODED/negotiated content an UNSTRUCTURED (JWS/CWS) or ENCRYPTED (JWE/CWE)
 * token secures — `Array<any> | boolean | Buffer | Dict | number | string`. Aegis
 * owns this type independently: its content-type universe is richer than the AES
 * codec's (it also round-trips nested TOKEN media types), so it is NOT an alias of
 * `AesContent`.
 *
 * Distinct from `TokenData` (`Buffer | string`, from `@lindorm/types`), which is
 * the ENCODED wire token. `TokenContent` is what a caller signs/encrypts and what
 * verify/decrypt reconstructs; the cty header carries the type across the wire so
 * the round-trip is faithful (Dict→json→Dict, string→text, Buffer→octet, and a
 * nested token→its native token form).
 */
export type TokenContent = Array<any> | boolean | Buffer | Dict | number | string;
