import {
  AuthenticationFactor,
  AuthenticationLevel,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";

export type URN =
  | AuthenticationFactor
  | AuthenticationMethod
  | AuthenticationStrategy
  | AuthenticationLevel;
