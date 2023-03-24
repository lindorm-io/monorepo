import { AuthenticationMethod } from "@lindorm-io/common-types";

export const filterAuthenticationMethods = (input?: Array<string>): Array<AuthenticationMethod> =>
  Array.isArray(input)
    ? (input.filter((key) =>
        Object.values(AuthenticationMethod).includes(key as AuthenticationMethod),
      ) as Array<AuthenticationMethod>)
    : [];
