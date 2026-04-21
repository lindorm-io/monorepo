import type {
  AuthorizationState,
  AuthorizationType,
  PylonHttpContext,
} from "../../types/index.js";

const DEFAULT: AuthorizationState = {
  type: "none",
  value: null,
} as const;

export const getAuthorization = (ctx: PylonHttpContext): AuthorizationState => {
  const [t, value] = ctx.get("authorization")?.split(" ") ?? [];
  const type = t?.toLowerCase() as AuthorizationType;

  if (!["basic", "bearer", "dpop"].includes(type)) {
    return DEFAULT;
  }

  if (!value || !value.length) {
    return DEFAULT;
  }

  return { type, value } as AuthorizationState;
};
