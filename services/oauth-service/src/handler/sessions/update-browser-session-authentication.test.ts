import MockDate from "mockdate";
import { BrowserSession } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestBrowserSession } from "../../fixtures/entity";
import { updateBrowserSessionAuthentication } from "./update-browser-session-authentication";
import { updateSessionWithAuthToken as _updateSessionWithAuthToken } from "../../util";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const updateSessionWithAuthToken = _updateSessionWithAuthToken as jest.Mock;

describe("updateBrowserSessionAuthentication", () => {
  let ctx: any;
  let token: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
      },
    };

    token = "auth-token";

    updateSessionWithAuthToken.mockImplementation((session) => session);
  });

  test("should resolve", async () => {
    await expect(
      updateBrowserSessionAuthentication(ctx, "sessionId", token),
    ).resolves.toBeUndefined();

    expect(updateSessionWithAuthToken).toHaveBeenCalledWith(
      expect.any(BrowserSession),
      "auth-token",
    );

    expect(ctx.repository.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.any(BrowserSession),
    );
  });
});
