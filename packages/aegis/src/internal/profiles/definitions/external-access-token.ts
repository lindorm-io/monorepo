import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Access token from a THIRD-PARTY authorization server — the interop sibling of
 * `access_token`, for a resource server that accepts tokens it did not issue.
 *
 * `access_token` is RFC 9068 strict and stays that way: it is enforced at MINT
 * as well as verify (mint/verify symmetry), so loosening it to accept someone
 * else's token would also permit us to ISSUE a degraded one. This profile is
 * the second name a mount selects instead.
 *
 * What it relaxes, and why each is a real interop fact rather than a courtesy:
 *
 * - `typ: none` — RFC 9068 `application/at+jwt` is far from universal. Other
 *   issuers stamp bare `JWT`, or nothing at all (RFC 7515 §4.1.9 makes `typ`
 *   OPTIONAL). ⚠ This does NOT reach every third-party typ: `JwtKit.verify`
 *   refuses a PRESENT typ that is neither `JWT` nor `<type>+jwt`
 *   (`jwt_invalid_typ`) as a wire-grammar guard, before any profile floor runs.
 *   So Keycloak's `typ: Bearer` is rejected at the wire, not here.
 * - no `clientId` — `client_id` is REQUIRED by RFC 9068 §2.2 but routinely
 *   absent from other issuers' access tokens.
 * - no `AUD_SINGLE_RESOURCE` — one `aud` is our own ADR, not a rule anyone else
 *   follows; multiple audiences are common.
 *
 * ⚠ What it does NOT relax, and MUST NOT:
 *
 * - `forbidden` is the ID-TOKEN DEFENCE, not decoration. With `typ: none` there
 *   is no structural discriminator left, and `typ: JWT` — what an id_token
 *   carries — is admitted. `nonce`/`at_hash`/`c_hash`/`s_hash` are id_token
 *   claims an access token never has, so forbidding them is what keeps an
 *   id_token out. The second defence is the verifier's REQUIRED `audience`: an
 *   id_token's `aud` is the CLIENT, not the resource server.
 * - `algClass: "asymmetric"` — a shared MAC secret both verifies AND forges, so
 *   a token a third party MACed with a secret we also hold proves nothing about
 *   who issued it.
 * - `lifetime` is non-null so the floor demands `exp` be PRESENT; an
 *   unexpiring bearer token from an issuer we do not control is not acceptable.
 *
 * `issuer: "per-token"` (as `delegation`) — the issuer is a third party, so the
 * deployment's own issuer must never become the expected one. A mount declares
 * which issuer it accepts through `ProfileVerifyOptions.issuer`; that value also
 * scopes the key lookup.
 *
 * `use: "verify"` — the profile exists to check a token we did not issue, so
 * `mint` refuses it outright and the compiler refuses the call site with it
 * (`ProfileContentFor` resolves the name to `never`). `autoInject: []` remains
 * the honest statement that nothing here is ours to generate; it was never a
 * guard, because a caller who hand-supplied `iss`/`iat`/`jti` still got a
 * degraded access token signed by our own vault.
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
