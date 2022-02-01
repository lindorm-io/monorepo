import { LogoutSession } from "../../entity";
import { handleRefreshSessionLogout } from "./handle-refresh-session-logout";
import { getTestRefreshSession, getTestClient, getTestLogoutSession } from "../../test/entity";

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
        clientCache: {
          find: jest.fn().mockResolvedValue(getTestClient()),
        },
      },
      repository: {
        refreshSessionRepository: {
          find: jest.fn().mockResolvedValue(getTestRefreshSession()),
          destroy: jest.fn(),
        },
      },
    };

    logoutSession = getTestLogoutSession();
  });

  test("should resolve", async () => {
    await expect(handleRefreshSessionLogout(ctx, logoutSession)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledTimes(1);
    expect(ctx.repository.refreshSessionRepository.destroy).toHaveBeenCalled();
  });
});
