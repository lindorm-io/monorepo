import MockDate from "mockdate";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { browserSessionCookieMiddleware } from "./browser-session-cookie-middleware";
import { createTestBrowserSession } from "../../fixtures/entity";
import { setBrowserSessionCookie as _setBrowserSessionCookie } from "../../handler";
import { BrowserSession } from "../../entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const next = async () => await Promise.resolve();

const setBrowserSessionCookie = _setBrowserSessionCookie as jest.Mock;

describe("browserSessionCookieMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      getCookie: jest.fn().mockImplementation(() => "da19e55c-ec5e-4474-a00f-e5848c962616"),
      entity: {},
      repository: {
        browserSessionRepository: {
          find: jest.fn().mockResolvedValue(createTestBrowserSession()),
          create: jest.fn().mockImplementation(async (entity) => entity),
          update: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
    };
  });

  test("should resolve session on context", async () => {
    await expect(browserSessionCookieMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.entity.browserSession).toStrictEqual(expect.any(BrowserSession));

    expect(ctx.repository.browserSessionRepository.find).toHaveBeenCalled();
    expect(ctx.repository.browserSessionRepository.update).toHaveBeenCalled();

    expect(ctx.repository.browserSessionRepository.create).not.toHaveBeenCalled();
    expect(setBrowserSessionCookie).toHaveBeenCalled();
  });

  test("should resolve with created cookie when cookie id does not exist", async () => {
    ctx.getCookie.mockImplementation(() => {});

    await expect(browserSessionCookieMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.entity.browserSession).toStrictEqual(expect.any(BrowserSession));

    expect(ctx.repository.browserSessionRepository.create).toHaveBeenCalled();
    expect(setBrowserSessionCookie).toHaveBeenCalled();
  });

  test("should resolve with created cookie when cookie cannot be found", async () => {
    ctx.repository.browserSessionRepository.find.mockRejectedValue(new EntityNotFoundError("test"));

    await expect(browserSessionCookieMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.entity.browserSession).toStrictEqual(expect.any(BrowserSession));

    expect(ctx.repository.browserSessionRepository.create).toHaveBeenCalled();
    expect(setBrowserSessionCookie).toHaveBeenCalled();
  });

  test("should reject on unexpected error", async () => {
    ctx.repository.browserSessionRepository.find.mockRejectedValue(new Error("test"));

    await expect(browserSessionCookieMiddleware(ctx, next)).rejects.toThrow(Error);
  });
});
