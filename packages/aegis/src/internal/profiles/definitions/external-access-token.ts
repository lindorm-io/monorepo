import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Access token from a THIRD-PARTY authorization server — the interop sibling of
 * `access_token`, for a resource server that accepts tokens it did not issue.
 * `access_token` is enforced at MINT as well as verify, so relaxing it would also
 * permit us to ISSUE a degraded token; this is the second name a mount selects.
 *
 * WHAT IT RELAXES: `typ: none` (RFC 9068 §2.1 / RFC 7515 §4.1.9), no `clientId`
 * (RFC 9068 §2.2), and no `AUD_SINGLE_RESOURCE`.
 *
 * ⚠ `typ: none` does NOT admit every third-party typ: `JwtKit.verify` refuses a
 * PRESENT typ that is neither `JWT` nor `<type>+jwt` (`jwt_invalid_typ`) as a
 * wire-grammar guard, before any profile floor runs.
 *
 * ⛔ WHAT IT MUST NOT RELAX:
 *
 * - `forbidden` is the ID-TOKEN DEFENCE, not decoration. With `typ: none` there is
 *   no structural discriminator left and `typ: JWT` is admitted, so forbidding the
 *   id_token-only claims is what keeps one out. The second defence is the
 *   verifier's REQUIRED `audience`: an id_token's `aud` is the CLIENT.
 * - `algClass: "asymmetric"` — a shared MAC secret both verifies AND forges.
 * - `lifetime` non-null, so the floor demands `exp` be PRESENT.
 *
 * `issuer: "per-token"` — the issuer is a third party, so the deployment's own
 * issuer must never become the expected one; a mount declares which it accepts
 * through `ProfileVerifyOptions.issuer`, and that value also scopes the key lookup.
 *
 * `use: "verify"` — `mint` refuses it outright and the compiler refuses the call
 * site with it (`ProfileContentFor` resolves the name to `never`). ⚠ `autoInject:
 * []` is a statement that nothing here is ours to generate, NOT a guard: a caller
 * hand-supplying `iss`/`iat`/`jti` would still get a token signed by our own vault.
 */
export const externalAccessTokenProfile = defineProfile({
  name: "external_access_token",
  use: "verify",
  typ: { presence: "none" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: ["issuer", "expiresAt", "audience", "subject", "issuedAt", "tokenId"],
    },
    {
      rule: "forbidden",
      on: ["mint", "verify"],
      claims: [
        "nonce",
        "accessTokenHash",
        "codeHash",
        "stateHash",
        "federationAssuranceLevel",
      ],
    },
    { rule: "match", on: ["mint", "verify"], condition: ISSUER_IS_URI },
    { rule: "shape", on: ["mint", "verify"], shape: "crossField" },
    { rule: "shape", on: ["mint", "verify"], shape: "confirmation" },
    { rule: "shape", on: ["mint", "verify"], shape: "actChain" },
  ],
  autoInject: [],
  issuer: "per-token",
  lifetime: "1h",
  encryptable: false,
  algClass: "asymmetric",
});
