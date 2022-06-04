import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { authorizationSessionCookieMiddleware } from "./authorization-session-cookie-middleware";
import { getTestAuthorizationSession } from "../../test/entity";
import { AuthorizationSession } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const next = async () => await Promise.resolve();

describe("authorizationSessionCookieMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache((options) =>
          getTestAuthorizationSession({
            id: "0a4fb70a-b0ed-4c3e-bc99-cdfd50a5faf4",
            ...options,
          }),
        ),
      },
      getCookie: jest.fn().mockImplementation(() => "0a4fb70a-b0ed-4c3e-bc99-cdfd50a5faf4"),
      setCookie: jest.fn(),
      entity: {},
    };
  });

  test("should resolve session on context", async () => {
    await expect(authorizationSessionCookieMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.entity.authorizationSession).toStrictEqual(expect.any(AuthorizationSession));
  });

  test("should reject on missing cookie id", async () => {
    ctx.getCookie.mockImplementation(() => {});

    await expect(authorizationSessionCookieMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should reject on missing session", async () => {
    ctx.cache.authorizationSessionCache.find.mockRejectedValue(new Error("test"));

    await expect(authorizationSessionCookieMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });
});
