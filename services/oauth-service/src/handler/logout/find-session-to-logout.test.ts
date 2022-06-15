import { BrowserSession, RefreshSession } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { findSessionToLogout } from "./find-session-to-logout";
import { createTestBrowserSession, createTestRefreshSession } from "../../fixtures/entity";
import { ClientError } from "@lindorm-io/errors";

describe("findSessionToLogout", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };
  });

  test("should resolve with browser session", async () => {
    await expect(findSessionToLogout(ctx, "sessionId")).resolves.toStrictEqual({
      session: expect.any(BrowserSession),
      type: "browser",
    });
  });

  test("should resolve with browser session on hint", async () => {
    await expect(findSessionToLogout(ctx, "sessionId", "browser")).resolves.toStrictEqual({
      session: expect.any(BrowserSession),
      type: "browser",
    });
  });

  test("should resolve with refresh session", async () => {
    ctx.repository.browserSessionRepository.find.mockRejectedValue(new EntityNotFoundError("test"));

    await expect(findSessionToLogout(ctx, "sessionId")).resolves.toStrictEqual({
      session: expect.any(RefreshSession),
      type: "refresh",
    });
  });

  test("should resolve with refresh session on hint", async () => {
    await expect(findSessionToLogout(ctx, "sessionId", "refresh")).resolves.toStrictEqual({
      session: expect.any(RefreshSession),
      type: "refresh",
    });

    expect(ctx.repository.browserSessionRepository.find).not.toHaveBeenCalled();
  });

  test("should throw on missing browser session", async () => {
    ctx.repository.browserSessionRepository.find.mockRejectedValue(new EntityNotFoundError("test"));

    await expect(findSessionToLogout(ctx, "sessionId", "browser")).rejects.toThrow(ClientError);
  });

  test("should throw on missing refresh session", async () => {
    ctx.repository.refreshSessionRepository.find.mockRejectedValue(new EntityNotFoundError("test"));

    await expect(findSessionToLogout(ctx, "sessionId", "refresh")).rejects.toThrow(ClientError);
  });
});
