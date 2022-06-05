import { LogoutSession } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import {
  createTestBrowserSession,
  createTestClient,
  createTestLogoutSession,
} from "../../fixtures/entity";
import { handleBrowserSessionLogout } from "./handle-browser-session-logout";

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
        clientCache: createMockCache(createTestClient),
      },
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
      },
    };

    logoutSession = createTestLogoutSession();
  });

  test("should resolve", async () => {
    await expect(handleBrowserSessionLogout(ctx, logoutSession)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledTimes(3);
    expect(ctx.repository.browserSessionRepository.destroy).toHaveBeenCalled();
  });
});
