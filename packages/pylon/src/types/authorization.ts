export type AuthorizationType = "basic" | "bearer" | "none";

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

export type AuthorizationState =
  | AuthorizationNone
  | AuthorizationBasic
  | AuthorizationBearer;
