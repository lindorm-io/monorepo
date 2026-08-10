import type { Dict } from "@lindorm/types";
import { actChainShape, cnfShape, crossField } from "../../utils/rules/index.js";
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
 * `autoInject: []` — nothing here is ours to generate. This profile exists to
 * VERIFY; the empty list means an accidental `mint` fails loudly on the missing
 * `iss`/`iat`/`jti` rather than quietly emitting a degraded access token.
 */
export const externalAccessTokenProfile = defineProfile({
  name: "external_access_token",
  typ: { presence: "none" },
  required: ["issuer", "expiresAt", "audience", "subject", "issuedAt", "tokenId"],
  forbidden: [
    "nonce",
    "accessTokenHash",
    "codeHash",
    "stateHash",
    "federationAssuranceLevel",
  ],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: [],
  issuer: "per-token",
  lifetime: "1h",
  encryptable: false,
  algClass: "asymmetric",
  rules: ISSUER_IS_URI,
  validate: (claims: Dict) => [
    ...crossField(claims),
    ...cnfShape(claims),
    ...actChainShape(claims),
  ],
});
