import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type { AssertOptions, DomainAssert } from "../../types/index.js";
import { createDomainTemporalMatchers } from "./jwt-temporal-matchers.js";
import { createJwtValidate } from "./jwt-validate.js";

/**
 * The predicate `Aegis.assert` / `Aegis.matches` evaluate: the temporal RANGE
 * merged with the caller's claim matchers.
 *
 * This is what makes `assert` "verify's claim checking, without the signature".
 * The temporal half comes from the SAME builder verify runs — one
 * implementation, two key namespaces (`createDomainTemporalMatchers` writes the
 * DOMAIN names because this surface matches a domain claim dict, the wire twin
 * writes JOSE names because verify matches a wire payload). With the same
 * options the two surfaces cannot answer differently, so a consumer never has to
 * hand-roll an `exp > now` that quietly carries no clock tolerance.
 *
 * Composed HERE rather than inside either builder, exactly as `JwtKit.verify`
 * composes its wire-keyed twin: one place decides the order, and a caller
 * matcher on a temporal claim wins because it is spread last.
 */
export const createAssertPredicate = (
  assert: DomainAssert,
  options: AssertOptions = {},
): Condition<Dict> => ({
  ...createDomainTemporalMatchers({
    clockTolerance: options.clockTolerance ?? 0,
    currentDate: options.currentDate,
    maxTokenAge: options.maxTokenAge,
    verifyExpiration: options.verifyExpiration,
    verifyNotBefore: options.verifyNotBefore,
    verifyIssuedAt: options.verifyIssuedAt,
    verifyAuthTime: options.verifyAuthTime,
  }),
  ...createJwtValidate(assert, options.algorithm),
});
