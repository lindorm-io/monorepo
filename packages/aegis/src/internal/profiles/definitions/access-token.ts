import type { Dict } from "@lindorm/types";
import {
  actChainShape,
  cnfShape,
  crossField,
  everyElementHasKey,
} from "../../utils/rules/index.js";
import { defineProfile } from "../define-profile.js";
import { AUD_SINGLE_RESOURCE, ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Access token — `at+jwt` (RFC 9068 §2.2). Server-signed. Never encryptable.
 * `aud` resolves to exactly one resource URI (ADR-0014). REQUIRED: iss, exp,
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
  required: [
    "issuer",
    "expiresAt",
    "audience",
    "subject",
    "clientId",
    "issuedAt",
    "tokenId",
  ],
  forbidden: ["federationAssuranceLevel"],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: ["issuedAt", "tokenId", "issuer"],
  issuer: "platform",
  lifetime: "1h",
  encryptable: false,
  algClass: "asymmetric",
  rules: { ...ISSUER_IS_URI, ...AUD_SINGLE_RESOURCE },
  validate: (claims: Dict) => [
    ...crossField(claims),
    ...everyElementHasKey(claims, "authorizationDetails", "type"),
    ...cnfShape(claims),
    ...actChainShape(claims),
  ],
});
