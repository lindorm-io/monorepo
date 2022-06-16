import MockDate from "mockdate";
import { RefreshSession } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestRefreshSession } from "../../fixtures/entity";
import { updateRefreshSessionAuthentication } from "./update-refresh-session-authentication";
import { updateSessionWithAuthToken as _updateSessionWithAuthToken } from "../../util";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const updateSessionWithAuthToken = _updateSessionWithAuthToken as jest.Mock;

describe("updateRefreshSessionAuthentication", () => {
  let ctx: any;
  let token: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };

    token = "auth-token";

    updateSessionWithAuthToken.mockImplementation((session) => session);
  });

  test("should resolve", async () => {
    await expect(
      updateRefreshSessionAuthentication(ctx, "sessionId", token),
    ).resolves.toBeUndefined();

    expect(updateSessionWithAuthToken).toHaveBeenCalledWith(
      expect.any(RefreshSession),
      "auth-token",
    );

    expect(ctx.repository.refreshSessionRepository.update).toHaveBeenCalledWith(
      expect.any(RefreshSession),
    );
  });
});
