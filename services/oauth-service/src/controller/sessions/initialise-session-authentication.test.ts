import MockDate from "mockdate";
import { generateAxiosBearerAuthMiddleware as _generateAxiosBearerAuthMiddleware } from "../../handler";
import { initialiseSessionAuthenticationController } from "./initialise-session-authentication";
import { getUnixTime } from "date-fns";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../../util";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const generateAxiosBearerAuthMiddleware = _generateAxiosBearerAuthMiddleware as jest.Mock;
const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;

describe("initialiseSessionAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        authenticationClient: {
          post: jest
            .fn()
            .mockResolvedValue({ data: { id: "07e871ef-b294-48f0-bcae-f85ddfbe4a64" } }),
        },
      },
      data: {
        codeChallenge: "codeChallenge",
        codeChallengeMethod: "codeChallengeMethod",
        country: "country",
      },
      token: {
        bearerToken: {
          authTime: getUnixTime(new Date("2021-01-01T07:00:00.000Z")),
          levelOfAssurance: 3,
          nonce: "gjwZbMwXKp8pv2W6",
          subject: "b09b7efa-833e-44fd-a884-f76e7a2b882f",
        },
        idToken: {
          authMethodsReference: ["email_otp", "phone_otp"],
          claims: {
            email: "test@lindorm.io",
            phoneNumber: "+46701234567",
            username: "username",
          },
        },
      },
    };

    getAdjustedAccessLevel.mockImplementation(() => 1);
    generateAxiosBearerAuthMiddleware.mockImplementation(() => "mock");
  });

  test("should resolve", async () => {
    await expect(initialiseSessionAuthenticationController(ctx)).resolves.toStrictEqual({
      body: { authenticationSessionId: "07e871ef-b294-48f0-bcae-f85ddfbe4a64" },
    });

    expect(ctx.axios.authenticationClient.post).toHaveBeenCalledWith("/internal/authentication", {
      body: {
        clientId: "6ea68f3d-e31e-4882-85a5-0a617f431fdd",
        codeChallenge: "codeChallenge",
        codeChallengeMethod: "codeChallengeMethod",
        country: "country",
        identityId: "b09b7efa-833e-44fd-a884-f76e7a2b882f",
        levelOfAssurance: 2,
        loginHint: ["test@lindorm.io", "+46701234567", "username"],
        methods: ["email_otp", "phone_otp"],
        nonce: "gjwZbMwXKp8pv2W6",
      },
      middleware: ["mock"],
    });
  });
});
