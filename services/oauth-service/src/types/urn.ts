import {
  AuthenticationFactor,
  AuthenticationLevel,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-types";

export type URN =
  | AuthenticationFactor
  | AuthenticationMethod
  | AuthenticationStrategy
  | AuthenticationLevel;
