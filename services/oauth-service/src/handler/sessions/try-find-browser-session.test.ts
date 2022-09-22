import MockDate from "mockdate";
import { BrowserSession } from "../../entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestBrowserSession } from "../../fixtures/entity";
import { tryFindBrowserSession } from "./try-find-browser-session";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("tryFindBrowserSession", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
      },
      metadata: {
        environment: "development",
      },
      cookies: {
        get: jest.fn().mockImplementation(() => "06715391-bea3-47db-acf4-ffa1f500bcc8"),
      },
    };
  });

  test("should resolve browser session", async () => {
    await expect(tryFindBrowserSession(ctx)).resolves.toStrictEqual(expect.any(BrowserSession));

    expect(ctx.repository.browserSessionRepository.find).toHaveBeenCalled();
    expect(ctx.repository.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        expires: new Date("2021-01-31T08:00:00.000Z"),
      }),
    );
  });

  test("should resolve undefined", async () => {
    ctx.cookies.get.mockImplementation(() => {});

    await expect(tryFindBrowserSession(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.browserSessionRepository.find).not.toHaveBeenCalled();
    expect(ctx.repository.browserSessionRepository.update).not.toHaveBeenCalled();
  });
});
