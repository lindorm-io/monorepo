import MockDate from "mockdate";
import { confirmLoginWithAuthenticationTokenController } from "./confirm-login-with-authentication-token";
import { confirmOauthAuthenticationSession as _confirmOauthAuthenticationSession } from "../../handler";
import { createMockCache } from "@lindorm-io/redis";
import { createTestLoginSession } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const confirmOauthAuthenticationSession = _confirmOauthAuthenticationSession as jest.Mock;

MockDate.set("2021-01-01T08:00:00.000Z");

describe("initialiseLoginController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: createMockCache(createTestLoginSession),
      },
      entity: {
        loginSession: createTestLoginSession(),
      },
      token: {
        authenticationConfirmationToken: {
          authContextClass: ["loa_3"],
          authMethodsReference: ["email_otp"],
          claims: {
            remember: true,
          },
          levelOfAssurance: 3,
          subject: "f9f38066-843f-47f6-bbc9-5f60866741b2",
        },
      },
      deleteCookie: jest.fn(),
    };

    confirmOauthAuthenticationSession.mockResolvedValue({ redirectTo: "https://confirm" });
  });

  test("should resolve", async () => {
    await expect(confirmLoginWithAuthenticationTokenController(ctx)).resolves.toStrictEqual({
      redirect: "https://confirm",
    });
  });
});
