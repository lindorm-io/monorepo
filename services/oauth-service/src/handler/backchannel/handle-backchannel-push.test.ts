import {
  axiosBasicAuthMiddleware as _axiosBasicAuthMiddleware,
  axiosBearerAuthMiddleware as _axiosBearerAuthMiddleware,
} from "@lindorm-io/axios";
import { OpenIdBackchannelAuthMode } from "@lindorm-io/common-enums";
import { createMockLogger } from "@lindorm-io/winston";
import { BackchannelSession, Client, ClientSession } from "../../entity";
import {
  createTestBackchannelSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { generateTokenResponse as _generateTokenResponse } from "../oauth";
import { generateServerBearerAuthMiddleware as _generateServerBearerAuthMiddleware } from "../token";
import { handleBackchannelPush } from "./handle-backchannel-push";

jest.mock("@lindorm-io/axios");
jest.mock("../oauth");
jest.mock("../token");

const axiosBasicAuthMiddleware = _axiosBasicAuthMiddleware as jest.Mock;
const axiosBearerAuthMiddleware = _axiosBearerAuthMiddleware as jest.Mock;
const generateServerBearerAuthMiddleware = _generateServerBearerAuthMiddleware as jest.Mock;
const generateTokenResponse = _generateTokenResponse as jest.Mock;

describe("handleBackchannelPush", () => {
  let ctx: any;
  let client: Client;
  let backchannelSession: BackchannelSession;
  let clientSession: ClientSession;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          post: jest.fn(),
        },
      },
      logger: createMockLogger(),
    };

    client = createTestClient({
      backchannelAuth: {
        mode: OpenIdBackchannelAuthMode.PUSH,
        uri: "uri",
        username: null,
        password: null,
      },
    });

    backchannelSession = createTestBackchannelSession();

    clientSession = createTestClientSession();

    axiosBasicAuthMiddleware.mockReturnValue("axiosBasicAuthMiddleware");
    axiosBearerAuthMiddleware.mockReturnValue("axiosBearerAuthMiddleware");
    generateServerBearerAuthMiddleware.mockReturnValue("generateServerBearerAuthMiddleware");
    generateTokenResponse.mockResolvedValue("generateTokenResponse");
  });

  test("should resolve with bearer token", async () => {
    await expect(
      handleBackchannelPush(ctx, client, backchannelSession, clientSession),
    ).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledWith("uri", {
      body: "generateTokenResponse",
      middleware: ["axiosBearerAuthMiddleware"],
    });
  });

  test("should resolve with basic auth", async () => {
    backchannelSession = createTestBackchannelSession({
      clientNotificationToken: null,
    });

    client.backchannelAuth.username = "username";
    client.backchannelAuth.password = "password";

    await expect(
      handleBackchannelPush(ctx, client, backchannelSession, clientSession),
    ).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledWith("uri", {
      body: "generateTokenResponse",
      middleware: ["axiosBasicAuthMiddleware"],
    });
  });

  test("should resolve with client credentials", async () => {
    backchannelSession = createTestBackchannelSession({
      clientNotificationToken: null,
    });

    await expect(
      handleBackchannelPush(ctx, client, backchannelSession, clientSession),
    ).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledWith("uri", {
      body: "generateTokenResponse",
      middleware: ["generateServerBearerAuthMiddleware"],
    });
  });
});
