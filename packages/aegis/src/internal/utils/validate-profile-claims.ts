import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { JwtError } from "../../errors/index.js";
import type { InvalidEntry, SignContext, TokenProfile } from "../../types/index.js";
import { actChainShape } from "./rules/act-chain-shape.js";
import { algPermitted } from "./rules/alg-permitted.js";
import { audSingleResource } from "./rules/aud-single-resource.js";
import { cnfShape } from "./rules/cnf-shape.js";
import { crossField } from "./rules/cross-field.js";
import { eventsShape } from "./rules/events-shape.js";
import { everyElementHasKey } from "./rules/every-element-has-key.js";
import { issUri } from "./rules/iss-uri.js";
import { subIdShape } from "./rules/sub-id-shape.js";

export type ValidateProfileContext = {
  algorithm?: KryptosSigAlgorithm | "none";
};

/**
 * Runs the structural RFC + crypto rules a profile opts into (via
 * `profile.rules`/`profile.algClass`), then the profile's own `validate`, and
 * throws the existing `jwt_claims_invalid` error when any rule fails.
 *
 * Pure composition over `internal/utils/rules/*` — NOT the predicate engine.
 */
export const validateProfileClaims = (
  profile: TokenProfile,
  claims: Dict,
  ctx: SignContext & ValidateProfileContext = {},
): void => {
  const invalid: Array<InvalidEntry> = [];

  const rules = profile.rules ?? {};

  if (rules.issUri) invalid.push(...issUri(claims));
  if (rules.crossField) invalid.push(...crossField(claims));
  if (rules.audSingleResource) invalid.push(...audSingleResource(claims));
  if (rules.authorizationDetailsType) {
    invalid.push(...everyElementHasKey(claims, "authorizationDetails", "type"));
  }
  if (rules.cnfShape) invalid.push(...cnfShape(claims));
  if (rules.actChainShape) invalid.push(...actChainShape(claims));
  if (rules.subIdShape) invalid.push(...subIdShape(claims));
  if (rules.eventsShape) invalid.push(...eventsShape(claims));

  if (profile.algClass) {
    invalid.push(...algPermitted(ctx.algorithm, profile.algClass));
  }

  invalid.push(...profile.validate(claims, ctx));

  if (invalid.length > 0) {
    throw new JwtError("Invalid token", {
      code: "jwt_claims_invalid",
      data: { invalid },
      debug: { invalid, profile: profile.name },
      title: "JWT Claims Invalid",
      details: "The assembled claims do not satisfy the profile's RFC validation rules.",
    });
  }
};
