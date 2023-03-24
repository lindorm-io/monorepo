import { Client, LogoutSession } from "../../entity";
import { createLogoutToken as _createLogoutToken } from "../token";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { handleClientSessionLogout } from "./handle-client-session-logout";
import {
  createTestClient,
  createTestClientSession,
  createTestLogoutSession,
} from "../../fixtures/entity";

jest.mock("../token");

const createLogoutToken = _createLogoutToken as jest.Mock;

describe("handleClientSessionLogout", () => {
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
      mongo: {
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
    };

    client = createTestClient();
    logoutSession = createTestLogoutSession({
      confirmedLogout: {
        browserSessionId: null,
        clientSessionId: "33287072-86da-42ca-986f-826767ce55e9",
      },
    });

    createLogoutToken.mockImplementation(() => ({ token: "logout.jwt.jwt" }));
  });

  test("should resolve", async () => {
    await expect(handleClientSessionLogout(ctx, logoutSession, client)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledTimes(1);
    expect(ctx.mongo.clientSessionRepository.destroy).toHaveBeenCalled();
  });
});
