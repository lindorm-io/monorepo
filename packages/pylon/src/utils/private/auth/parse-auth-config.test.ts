import { PkceMethod } from "@lindorm/enums";
import { parseAuthConfig } from "./parse-auth-config";

describe("parseAuthConfig", () => {
  test("should merge defaults with minimal options", () => {
    expect(
      parseAuthConfig({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        issuer: "https://issuer.com",
      }),
    ).toMatchSnapshot();
  });

  test("should merge defaults with options", () => {
    expect(
      parseAuthConfig({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        issuer: "https://issuer.com",

        codeChallengeMethod: PkceMethod.Plain,
        tokenExpiry: "1d",

        dynamicRedirectDomains: ["https://client.com"],

        refresh: {
          maxAge: "6m",
          mode: "none",
        },
        staticRedirect: {
          login: "https://client.com/login/static",
        },
      }),
    ).toMatchSnapshot();
  });
});
