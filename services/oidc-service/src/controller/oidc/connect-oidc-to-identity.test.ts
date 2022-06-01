import { connectOidcToIdentityController } from "./connect-oidc-to-identity";
import { createOidcSession as _createOidcSession } from "../../handler";

jest.mock("../../handler");

const createOidcSession = _createOidcSession as jest.Mock;

describe("connectOidcToIdentityController", () => {
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

    createOidcSession.mockResolvedValue(new URL("https://resolved.url/"));
  });

  test("should resolve", async () => {
    await expect(connectOidcToIdentityController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(createOidcSession).toHaveBeenCalled();
  });
});
