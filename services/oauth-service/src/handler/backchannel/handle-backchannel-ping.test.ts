import {
  axiosBasicAuthMiddleware as _axiosBasicAuthMiddleware,
  axiosBearerAuthMiddleware as _axiosBearerAuthMiddleware,
} from "@lindorm-io/axios";
import { OpenIdBackchannelAuthMode } from "@lindorm-io/common-enums";
import { createMockLogger } from "@lindorm-io/winston";
import { BackchannelSession, Client } from "../../entity";
import { createTestBackchannelSession, createTestClient } from "../../fixtures/entity";
import { generateServerBearerAuthMiddleware as _generateServerBearerAuthMiddleware } from "../token";
import { handleBackchannelPing } from "./handle-backchannel-ping";

jest.mock("@lindorm-io/axios");
jest.mock("../token");

const axiosBasicAuthMiddleware = _axiosBasicAuthMiddleware as jest.Mock;
const axiosBearerAuthMiddleware = _axiosBearerAuthMiddleware as jest.Mock;
const generateServerBearerAuthMiddleware = _generateServerBearerAuthMiddleware as jest.Mock;

describe("handleBackchannelPing", () => {
  let ctx: any;
  let client: Client;
  let backchannelSession: BackchannelSession;

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
        mode: OpenIdBackchannelAuthMode.PING,
        uri: "uri",
        username: null,
        password: null,
      },
    });

    backchannelSession = createTestBackchannelSession();

    axiosBasicAuthMiddleware.mockReturnValue("axiosBasicAuthMiddleware");
    axiosBearerAuthMiddleware.mockReturnValue("axiosBearerAuthMiddleware");
    generateServerBearerAuthMiddleware.mockReturnValue("generateServerBearerAuthMiddleware");
  });

  test("should resolve with bearer token", async () => {
    await expect(handleBackchannelPing(ctx, client, backchannelSession)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledWith("uri", {
      body: {
        authReqId: backchannelSession.id,
      },
      middleware: ["axiosBearerAuthMiddleware"],
    });
  });

  test("should resolve with basic auth", async () => {
    backchannelSession = createTestBackchannelSession({
      clientNotificationToken: null,
    });

    client.backchannelAuth.username = "username";
    client.backchannelAuth.password = "password";

    await expect(handleBackchannelPing(ctx, client, backchannelSession)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledWith("uri", {
      body: {
        authReqId: backchannelSession.id,
      },
      middleware: ["axiosBasicAuthMiddleware"],
    });
  });

  test("should resolve with client credentials", async () => {
    backchannelSession = createTestBackchannelSession({
      clientNotificationToken: null,
    });

    await expect(handleBackchannelPing(ctx, client, backchannelSession)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.post).toHaveBeenCalledWith("uri", {
      body: {
        authReqId: backchannelSession.id,
      },
      middleware: ["generateServerBearerAuthMiddleware"],
    });
  });
});
