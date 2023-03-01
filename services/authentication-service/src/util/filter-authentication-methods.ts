import { AuthenticationMethod } from "@lindorm-io/common-types";

export const filterAuthenticationMethod = (input?: string[]): AuthenticationMethod[] =>
  Array.isArray(input)
    ? (input.filter((key) =>
        Object.values(AuthenticationMethod).includes(key as AuthenticationMethod),
      ) as Array<AuthenticationMethod>)
    : [];
