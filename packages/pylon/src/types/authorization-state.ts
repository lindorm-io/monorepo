import { AuthorizationType } from "../enums";

type AuthorizationNone = {
  type: AuthorizationType.None;
  value: null;
};

type AuthorizationBasic = {
  type: AuthorizationType.Basic;
  value: string;
};

type AuthorizationBearer = {
  type: AuthorizationType.Bearer;
  value: string;
};

export type AuthorizationState =
  | AuthorizationNone
  | AuthorizationBasic
  | AuthorizationBearer;
