export type AuthorizationType = "basic" | "bearer" | "dpop" | "none";

type AuthorizationNone = {
  type: "none";
  value: null;
};

type AuthorizationBasic = {
  type: "basic";
  value: string;
};

type AuthorizationBearer = {
  type: "bearer";
  value: string;
};

type AuthorizationDpop = {
  type: "dpop";
  value: string;
};

export type AuthorizationState =
  | AuthorizationNone
  | AuthorizationBasic
  | AuthorizationBearer
  | AuthorizationDpop;
