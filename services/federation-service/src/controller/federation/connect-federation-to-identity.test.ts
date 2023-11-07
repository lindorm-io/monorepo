import { createFederationSession as _createFederationSession } from "../../handler";
import { connectFederationToIdentityController } from "./connect-federation-to-identity";

jest.mock("../../handler");

const createFederationSession = _createFederationSession as jest.Mock;

describe("connectFederationToIdentityController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        callbackUri: "callbackUri",
        provider: "apple",
      },
      token: {
        bearerToken: {
          subject: "identityId",
        },
      },
    };

    createFederationSession.mockResolvedValue(new URL("https://resolved.url/"));
  });

  test("should resolve", async () => {
    await expect(connectFederationToIdentityController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(createFederationSession).toHaveBeenCalled();
  });
});
