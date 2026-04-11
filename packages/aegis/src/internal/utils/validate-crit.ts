/**
 * IANA-registered JOSE header parameter names.
 * Source: https://www.iana.org/assignments/jose/jose.xhtml#web-signature-encryption-header-parameters
 *
 * Per RFC 7515 Section 4.1.11, the `crit` header parameter MUST NOT contain
 * any of these registered names — `crit` is for extension parameters only.
 */
const IANA_REGISTERED_JOSE_HEADER_PARAMS = new Set([
  // RFC 7515 (JWS)
  "alg",
  "jku",
  "jwk",
  "kid",
  "x5u",
  "x5c",
  "x5t",
  "x5t#S256",
  "typ",
  "cty",
  "crit",
  // RFC 7516 (JWE)
  "enc",
  "zip",
  // RFC 7518 (JWA)
  "epk",
  "apu",
  "apv",
  "iv",
  "tag",
  "p2s",
  "p2c",
  // RFC 7797 (Unencoded Payload Option)
  "b64",
  // RFC 8225 (PASSporT)
  "ppt",
  // RFC 8555 (ACME)
  "url",
  "nonce",
  // RFC 9321 (SVT)
  "svt",
]);

/**
 * Validate the `crit` (Critical) header parameter per RFC 7515 Section 4.1.11.
 *
 * Returns `null` when `crit` is valid (or absent), and an error message string
 * when it violates one of the RFC requirements. The caller is expected to
 * translate a non-null return into its own Kit-specific error class.
 */
// Generic over any header-shaped object with an optional `crit`. This function
// only reads `crit` and performs a membership check on `decoded`, so it works
// for any header dict regardless of whether `alg` is narrowed, omitted, etc.
export const validateCrit = (
  decoded: { crit?: unknown } & Record<string, unknown>,
): string | null => {
  const crit = decoded.crit;

  if (crit === undefined) return null;

  if (!Array.isArray(crit)) {
    return "crit must be an array";
  }

  // RFC 7515 §4.1.11: "Producers MUST NOT use the empty list [] as the crit value."
  if (crit.length === 0) {
    return "crit must not be an empty array when present";
  }

  for (const name of crit) {
    if (typeof name !== "string") {
      return "crit entries must be strings";
    }

    // RFC 7515 §4.1.11: "crit MUST NOT contain any Header Parameter names
    // defined by this specification or [JWA] [...]"
    if (IANA_REGISTERED_JOSE_HEADER_PARAMS.has(name)) {
      return `crit must not contain the IANA-registered header parameter "${name}"`;
    }

    // RFC 7515 §4.1.11: "The Header Parameters listed in the 'crit' list
    // [...] MUST be integrity protected; therefore, they MUST be located in
    // the JWS Protected Header [...] The 'crit' Header Parameter MUST NOT be
    // included unless one or more extensions are actually being used [...]"
    // — enforced via the existence check below.
    if (!(name in decoded)) {
      return `crit listed parameter "${name}" is not present in the header`;
    }
  }

  return null;
};
