import { ConnectSession, Identity } from "../../entity";
import { IdentifierType } from "../../common";
import { clientCredentialsMiddleware as _clientCredentialsMiddleware } from "../../middleware";
import { getTestIdentity } from "../../test/entity";
import { initialiseConnectSession } from "./initialise-connect-session";

jest.mock("../../middleware");

const clientCredentialsMiddleware = _clientCredentialsMiddleware as jest.Mock;

describe("initialiseConnectSession", () => {
  let ctx: any;
  let identity: Identity;
  let options: any;

  beforeEach(() => {
    ctx = {
      axios: {
        communicationClient: {
          post: jest.fn(),
        },
        oauthClient: {},
      },
      cache: {
        connectSessionCache: {
          create: jest.fn().mockImplementation(async (arg) => arg),
        },
      },
    };

    identity = getTestIdentity();

    options = {
      identifier: "identifier",
      type: IdentifierType.EMAIL,
    };

    clientCredentialsMiddleware.mockImplementation(() => "middleware");
  });

  test("should resolve", async () => {
    await expect(initialiseConnectSession(ctx, identity, options)).resolves.toStrictEqual(
      expect.any(ConnectSession),
    );
  });
});
