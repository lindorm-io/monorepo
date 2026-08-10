/**
 * The hash-DERIVE matchers — the ONLY matchers the registry can't resolve by a
 * name lookup. Each names a SOURCE value (the raw access token / code / state)
 * that aegis HASHES into a claim, so the matcher key ("accessToken")
 * deliberately differs from the claim it lands in ("accessTokenHash") and the
 * value is computed, not name-mapped. Every OTHER matcher key is a plain domain
 * name the registry owns.
 *
 * VERIFY-ONLY (`DomainHashMatchers`): the digest is tied to the token's signing
 * algorithm, which only a surface holding the verifying key can resolve. Mint
 * and verify use this table; `Aegis.assert` matches the computed hash under its
 * own domain claim name instead.
 *
 * The table maps the matcher key to the DOMAIN claim, and the registry maps that
 * domain to its wire name — so each consumer takes the name IT speaks from one
 * place: mint writes the domain claim, and the verify path takes
 * `claimByDomain(domain).jose`. A second hard-coded `at_hash`/`c_hash`/`s_hash`
 * list is exactly the drift this avoids.
 */
export const HASH_MATCHERS: Readonly<Record<string, string>> = {
  accessToken: "accessTokenHash",
  authCode: "codeHash",
  authState: "stateHash",
};
