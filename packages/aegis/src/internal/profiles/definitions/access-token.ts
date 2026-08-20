import { defineProfile } from "../define-profile.js";
import { AUD_SINGLE_RESOURCE, ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Access token — `at+jwt` (RFC 9068 §2.2). Server-signed. Never encryptable.
 * `aud` resolves to exactly one resource URI (`AUD_SINGLE_RESOURCE`). REQUIRED: iss, exp,
 * aud, sub, client_id, iat, jti.
 *
 * `algClass: "asymmetric"` is a DELIBERATE deviation: RFC 9068 §2.1 only
 * RECOMMENDS asymmetric, but a shared MAC secret lets every holder forge
 * tokens, and a token no resource server can verify is not a token. It is part
 * of the signing floor, so an asymmetric key is SELECTED rather than an
 * HS-signed token being minted and caught afterwards — and a deployment whose
 * vault holds no asymmetric signing key now fails to mint, loudly, instead of
 * silently issuing a forgeable token.
 */
export const accessTokenProfile = defineProfile({
  name: "access_token",
  typ: { presence: "required", value: "application/at+jwt" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: [
        "issuer",
        "expiresAt",
        "audience",
        "subject",
        "clientId",
        "issuedAt",
        "tokenId",
      ],
    },
    { rule: "forbidden", on: ["mint", "verify"], claims: ["federationAssuranceLevel"] },
    { rule: "match", on: ["mint", "verify"], condition: ISSUER_IS_URI },
    { rule: "match", on: ["mint", "verify"], condition: AUD_SINGLE_RESOURCE },
    { rule: "shape", on: ["mint", "verify"], shape: "crossField" },
    { rule: "shape", on: ["mint", "verify"], shape: "confirmation" },
    { rule: "shape", on: ["mint", "verify"], shape: "actChain" },
  ],
  autoInject: ["issuedAt", "tokenId", "issuer"],
  issuer: "platform",
  lifetime: "1h",
  encryptable: false,
  algClass: "asymmetric",
});
