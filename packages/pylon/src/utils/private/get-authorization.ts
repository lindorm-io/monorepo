import { AuthorizationType } from "../../enums";
import { AuthorizationState, PylonHttpContext } from "../../types";

const DEFAULT: AuthorizationState = {
  type: AuthorizationType.None,
  value: null,
} as const;

export const getAuthorization = (ctx: PylonHttpContext): AuthorizationState => {
  const [t, value] = ctx.get("authorization")?.split(" ") ?? [];
  const type = t?.toLowerCase() as AuthorizationType;

  if (![AuthorizationType.Basic, AuthorizationType.Bearer].includes(type)) {
    return DEFAULT;
  }

  if (!value || !value.length) {
    return DEFAULT;
  }

  return { type, value } as AuthorizationState;
};
