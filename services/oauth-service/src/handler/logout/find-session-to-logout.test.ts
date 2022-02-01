import { BrowserSession, RefreshSession } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { findSessionToLogout } from "./find-session-to-logout";
import { getTestBrowserSession, getTestRefreshSession } from "../../test/entity";

describe("findSessionToLogout", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      repository: {
        browserSessionRepository: {
          find: jest.fn().mockResolvedValue(getTestBrowserSession()),
        },
        refreshSessionRepository: {
          find: jest.fn().mockResolvedValue(getTestRefreshSession()),
        },
      },
    };
  });

  test("should resolve with browser session", async () => {
    await expect(findSessionToLogout(ctx, "sessionId")).resolves.toStrictEqual({
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
});
