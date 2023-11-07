import { createFederationSession as _createFederationSession } from "../../handler";
import { initialiseFederationSessionController } from "./initialise-federation-session";

jest.mock("../../handler");

const createFederationSession = _createFederationSession as jest.Mock;

describe("initialiseFederationSessionController", () => {
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

    createFederationSession.mockResolvedValue(new URL("https://resolved.url/"));
  });

  test("should resolve", async () => {
    await expect(initialiseFederationSessionController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "https://resolved.url/" },
    });

    expect(createFederationSession).toHaveBeenCalled();
  });
});
