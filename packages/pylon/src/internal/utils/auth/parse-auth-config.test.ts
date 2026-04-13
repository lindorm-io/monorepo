import { parseAuthConfig } from "./parse-auth-config";

describe("parseAuthConfig", () => {
  test("should return config with null router when no router options", () => {
    expect(
      parseAuthConfig({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        issuer: "https://issuer.com",
      }),
    ).toMatchSnapshot();
  });

  test("should merge defaults with router options", () => {
    expect(
      parseAuthConfig({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        issuer: "https://issuer.com",
        router: {},
      }),
    ).toMatchSnapshot();
  });

  test("should merge defaults with custom router options", () => {
    expect(
      parseAuthConfig({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        issuer: "https://issuer.com",
        defaultTokenExpiry: "1d",
        refresh: {
          maxAge: "6m",
          mode: "none",
        },
        router: {
          authorize: {
            codeChallengeMethod: "plain",
            resource: "https://api.example.com",
          },
          dynamicRedirectDomains: ["https://client.com"],
          resourceKey: "audience",
          staticRedirect: {
            login: "https://client.com/login/static",
          },
        },
      }),
    ).toMatchSnapshot();
  });

  test("should merge refresh defaults when refresh is partially specified", () => {
    expect(
      parseAuthConfig({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        issuer: "https://issuer.com",
        refresh: { mode: "max_age" },
      }),
    ).toMatchSnapshot();
  });
});
