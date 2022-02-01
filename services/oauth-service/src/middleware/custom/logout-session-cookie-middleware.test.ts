import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { logoutSessionCookieMiddleware } from "./logout-session-cookie-middleware";
import { getTestAuthorizationSession } from "../../test/entity";
import { AuthorizationSession } from "../../entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const next = async () => await Promise.resolve();

describe("logoutSessionCookieMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: {
          find: jest.fn().mockResolvedValue(
            getTestAuthorizationSession({
              id: "0a4fb70a-b0ed-4c3e-bc99-cdfd50a5faf4",
            }),
          ),
        },
      },
      getCookie: jest.fn().mockImplementation(() => "0a4fb70a-b0ed-4c3e-bc99-cdfd50a5faf4"),
      setCookie: jest.fn(),
      entity: {},
    };
  });

  test("should resolve session on context", async () => {
    await expect(logoutSessionCookieMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.entity.logoutSession).toStrictEqual(expect.any(AuthorizationSession));
  });

  test("should reject on missing cookie id", async () => {
    ctx.getCookie.mockImplementation(() => {});

    await expect(logoutSessionCookieMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should reject on missing session", async () => {
    ctx.cache.logoutSessionCache.find.mockRejectedValue(new Error("test"));

    await expect(logoutSessionCookieMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });
});
