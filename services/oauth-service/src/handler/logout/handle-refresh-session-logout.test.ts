import { Client, LogoutSession } from "../../entity";
import { createLogoutToken as _createLogoutToken } from "../token";
import { createMockRepository } from "@lindorm-io/mongo";
import { handleRefreshSessionLogout } from "./handle-refresh-session-logout";
import {
  createTestRefreshSession,
  createTestClient,
  createTestLogoutSession,
} from "../../fixtures/entity";

jest.mock("../token");

const createLogoutToken = _createLogoutToken as jest.Mock;

describe("handleRefreshSessionLogout", () => {
  let ctx: any;
  let client: Client;
  let logoutSession: LogoutSession;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          post: jest.fn(),
        },
      },
      repository: {
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };

    client = createTestClient();
    logoutSession = createTestLogoutSession({
      confirmedLogout: {
        accessSessionId: null,
        browserSessionId: null,
        refreshSessionId: "33287072-86da-42ca-986f-826767ce55e9",
      },
    });

    createLogoutToken.mockImplementation(() => ({ token: "logout.jwt.jwt" }));
  });

  test("should resolve", async () => {
    await expect(handleRefreshSessionLogout(ctx, logoutSession, client)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledTimes(1);
    expect(ctx.repository.refreshSessionRepository.destroy).toHaveBeenCalled();
  });
});
