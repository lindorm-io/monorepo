import { AuthenticationMethod, AuthenticationMethods } from "@lindorm-io/common-types";

export const filterAuthenticationMethods = (input?: string[]): AuthenticationMethod[] =>
  Array.isArray(input)
    ? (input.filter((key) =>
        Object.values(AuthenticationMethods).includes(key as AuthenticationMethod),
      ) as Array<AuthenticationMethod>)
    : [];
