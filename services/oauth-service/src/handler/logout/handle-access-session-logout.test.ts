import { Client, LogoutSession } from "../../entity";
import { createLogoutToken as _createLogoutToken } from "../token";
import { createMockRepository } from "@lindorm-io/mongo";
import { handleAccessSessionLogout } from "./handle-access-session-logout";
import {
  createTestAccessSession,
  createTestClient,
  createTestLogoutSession,
} from "../../fixtures/entity";

jest.mock("../token");

const createLogoutToken = _createLogoutToken as jest.Mock;

describe("handleAccessSessionLogout", () => {
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
        accessSessionRepository: createMockRepository(createTestAccessSession),
      },
    };

    client = createTestClient();
    logoutSession = createTestLogoutSession({
      confirmedLogout: {
        accessSessionId: "33287072-86da-42ca-986f-826767ce55e9",
        browserSessionId: null,
        refreshSessionId: null,
      },
    });

    createLogoutToken.mockImplementation(() => ({ token: "logout.jwt.jwt" }));
  });

  test("should resolve", async () => {
    await expect(handleAccessSessionLogout(ctx, logoutSession, client)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledTimes(1);
    expect(ctx.repository.accessSessionRepository.destroy).toHaveBeenCalled();
  });
});
