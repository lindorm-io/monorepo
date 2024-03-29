import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import { createTestFederationSession } from "../fixtures/entity";
import { createFederationSession } from "./create-federation-session";

MockDate.set("2022-01-01T08:00:00.000Z");

describe("createFederationSession", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      redis: {
        federationSessionCache: createMockRedisRepository(createTestFederationSession),
      },
    };

    options = {
      callbackUri: "https://callback.url/callback",
      expires: new Date("2022-01-01T22:00:00.000Z"),
      identityId: "e86fe6bd-0ab6-4441-82f1-bb884de44b7f",
      loginHint: "test@lindorm.io",
      provider: "apple",
    };
  });

  test("should resolve", async () => {
    await expect(createFederationSession(ctx, options)).resolves.toStrictEqual(expect.any(URL));
  });

  test("should resolve URL", async () => {
    const url = await createFederationSession(ctx, options);

    expect(url.host).toBe("apple.com");
    expect(url.pathname).toBe("/authorize");
    expect(url.searchParams.get("client_id")).toBe("apple_client_id");
    expect(url.searchParams.get("code_challenge")).toStrictEqual(expect.any(String));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("login_hint")).toBe("test@lindorm.io");
    expect(url.searchParams.get("nonce")).toStrictEqual(expect.any(String));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://federation.test.lindorm.io/callback",
    );
    expect(url.searchParams.get("response_mode")).toBe("query");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email");
    expect(url.searchParams.get("state")).toStrictEqual(expect.any(String));
  });
});
