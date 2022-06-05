import { LogoutSession } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import {
  createTestRefreshSession,
  createTestClient,
  createTestLogoutSession,
} from "../../fixtures/entity";
import { handleRefreshSessionLogout } from "./handle-refresh-session-logout";

jest.mock("./handle-consent-session-on-logout");

jest.mock("../token", () => ({
  createLogoutToken: jest.fn().mockImplementation(() => ({ token: "logout.jwt.jwt" })),
}));

describe("handleRefreshSessionLogout", () => {
  let ctx: any;
  let logoutSession: LogoutSession;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          post: jest.fn(),
        },
      },
      cache: {
        clientCache: createMockCache(createTestClient),
      },
      repository: {
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };

    logoutSession = createTestLogoutSession();
  });

  test("should resolve", async () => {
    await expect(handleRefreshSessionLogout(ctx, logoutSession)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledTimes(1);
    expect(ctx.repository.refreshSessionRepository.destroy).toHaveBeenCalled();
  });
});
