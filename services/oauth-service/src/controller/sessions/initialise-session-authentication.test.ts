import MockDate from "mockdate";
import { generateAxiosBearerAuthMiddleware as _generateAxiosBearerAuthMiddleware } from "../../handler";
import { initialiseSessionAuthenticationController } from "./initialise-session-authentication";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const generateAxiosBearerAuthMiddleware = _generateAxiosBearerAuthMiddleware as jest.Mock;

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
        codeMethod: "codeMethod",
        country: "country",
      },
      token: {
        bearerToken: {
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

    generateAxiosBearerAuthMiddleware.mockImplementation(() => "mock");
  });

  test("should resolve", async () => {
    await expect(initialiseSessionAuthenticationController(ctx)).resolves.toStrictEqual({
      body: { authenticationSessionId: "07e871ef-b294-48f0-bcae-f85ddfbe4a64" },
    });

    expect(ctx.axios.authenticationClient.post).toHaveBeenCalledWith("/internal/authentication", {
      data: {
        clientId: "6ea68f3d-e31e-4882-85a5-0a617f431fdd",
        codeChallenge: "codeChallenge",
        codeMethod: "codeMethod",
        country: "country",
        identityId: "b09b7efa-833e-44fd-a884-f76e7a2b882f",
        levelOfAssurance: 3,
        loginHint: ["test@lindorm.io", "+46701234567", "username"],
        methods: ["email_otp", "phone_otp"],
        nonce: "gjwZbMwXKp8pv2W6",
      },
      middleware: ["mock"],
    });
  });
});
