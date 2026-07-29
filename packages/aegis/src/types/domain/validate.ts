import type { ConditionOperator } from "@lindorm/match";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { DomainAssert } from "./domain-assert.js";

// The declarative matcher for `Aegis.assert` (and the hash-derive `accessToken`/
// `authCode`/`authState` inputs, which need `algorithm` to hash). The matcher
// vocabulary is the domain `assert` set; `algorithm`/`tokenType` are the two
// extra knobs the flat-dict applier honours.
export type ValidateJwtOptions = DomainAssert & {
  algorithm?: KryptosAlgorithm;
  tokenType?: string | ConditionOperator<string>;
  accessToken?: string;
  authCode?: string;
  authState?: string;
};
