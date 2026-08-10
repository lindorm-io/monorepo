/**
 * The hash-DERIVE matchers — the ONLY matchers the registry can't resolve by a
 * name lookup. Each names a SOURCE value (the raw access token / code / state)
 * that aegis HASHES into a claim, so the option key ("accessToken") deliberately
 * differs from the claim it lands in ("accessTokenHash") and the value is
 * computed, not name-mapped. Every OTHER matcher key is a plain domain name the
 * registry owns.
 *
 * The table maps the option key to the DOMAIN claim, and the registry maps that
 * domain to its wire name — so each consumer takes the name IT speaks from one
 * place: mint writes the domain claim, the assert path keys its predicate by the
 * domain claim, and the verify path takes `claimByDomain(domain).jose`. A second
 * hard-coded `at_hash`/`c_hash`/`s_hash` list is exactly the drift this avoids.
 */
export const HASH_MATCHERS: Readonly<Record<string, string>> = {
  accessToken: "accessTokenHash",
  authCode: "codeHash",
  authState: "stateHash",
};
