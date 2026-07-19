import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict, Predicate, PredicateOperator } from "@lindorm/types";
import type { JwtClaims, VerifyJwtOptions } from "../../types/index.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { createTemporalMatchers } from "./jwt-temporal-matchers.js";

/**
 * Compose the verify predicate from its two halves: the temporal range matchers
 * (`iat`/`nbf`/`exp`/`auth_time` with clock tolerance — the KIT half) and the
 * identity/presence matchers (named claim matchers + `exp` presence requiredness
 * — the AEGIS half). The identity half is spread last so its presence-tightened
 * `exp` matcher (when required) wins over the temporal builder's if-present form.
 *
 * Phase 8 relocates the two builders (temporal → JwtKit, identity → Aegis); this
 * thin composition keeps every current caller (`JwtKit.verify`, CWT claim
 * validation) behaviour-identical in the meantime.
 */
export const createJwtVerify = (
  algorithm: KryptosAlgorithm,
  verify: VerifyJwtOptions,
  clockTolerance: number,
): Predicate<Dict> => {
  const predicate: Partial<Record<keyof JwtClaims, PredicateOperator<any>>> = {
    ...createTemporalMatchers(clockTolerance),
    ...createIdentityMatchers(algorithm, verify, clockTolerance),
  };

  return predicate as Predicate<Dict>;
};
