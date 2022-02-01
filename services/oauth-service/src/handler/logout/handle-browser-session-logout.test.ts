import { LogoutSession } from "../../entity";
import { handleBrowserSessionLogout } from "./handle-browser-session-logout";
import { getTestBrowserSession, getTestClient, getTestLogoutSession } from "../../test/entity";

jest.mock("./handle-consent-session-on-logout");

jest.mock("../token", () => ({
  createLogoutToken: jest.fn().mockImplementation(() => ({ token: "logout.jwt.jwt" })),
}));

describe("handleBrowserSessionLogout", () => {
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
        browserSessionRepository: {
          find: jest.fn().mockResolvedValue(getTestBrowserSession()),
          destroy: jest.fn(),
        },
      },
    };

    logoutSession = getTestLogoutSession();
  });

  test("should resolve", async () => {
    await expect(handleBrowserSessionLogout(ctx, logoutSession)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledTimes(3);
    expect(ctx.repository.browserSessionRepository.destroy).toHaveBeenCalled();
  });
});
