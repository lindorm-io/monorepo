import { initialiseOidcSessionController } from "./initialise-oidc-session";
import { createOidcSession as _createOidcSession } from "../../handler";

jest.mock("../../handler");

const createOidcSession = _createOidcSession as jest.Mock;

describe("initialiseOidcSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        callbackUri: "callbackUri",
        expires: "2022-01-01T08:00:00.000Z",
        loginHint: "loginHint",
        provider: "apple",
      },
    };

    createOidcSession.mockResolvedValue(new URL("https://resolved.url/"));
  });

  test("should resolve", async () => {
    await expect(initialiseOidcSessionController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "https://resolved.url/" },
    });

    expect(createOidcSession).toHaveBeenCalled();
  });
});
