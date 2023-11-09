import { AuthenticationStrategy } from "@lindorm-io/common-enums";

export const filterAuthenticationStrategies = (
  input?: Array<string>,
): Array<AuthenticationStrategy> =>
  Array.isArray(input)
    ? (input.filter((key) =>
        Object.values(AuthenticationStrategy).includes(key as AuthenticationStrategy),
      ) as Array<AuthenticationStrategy>)
    : [];
