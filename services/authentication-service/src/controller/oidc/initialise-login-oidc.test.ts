import { ClientError } from "@lindorm-io/errors";
import { axiosInitialiseOidcSession as _axiosInitialiseOidcSession } from "../../handler";
import { createTestLoginSession } from "../../fixtures/entity";
import { initialiseLoginOidcController } from "./initialise-login-oidc";
import { createMockCache } from "@lindorm-io/redis";

jest.mock("../../handler");

const axiosInitialiseOidcSession = _axiosInitialiseOidcSession as jest.Mock;

describe("initialiseLoginOidcController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: createMockCache(createTestLoginSession),
      },
      data: {
        provider: "apple",
        remember: true,
      },
      entity: {
        loginSession: createTestLoginSession({
          allowedOidc: ["apple"],
        }),
      },
    };

    axiosInitialiseOidcSession.mockResolvedValue({ redirectTo: "redirectTo" });
  });

  test("should resolve", async () => {
    await expect(initialiseLoginOidcController(ctx)).resolves.toStrictEqual({
      redirect: "redirectTo",
    });
  });

  test("should reject invalid provider", async () => {
    ctx.data.provider = "wrong";

    await expect(initialiseLoginOidcController(ctx)).rejects.toThrow(ClientError);
  });
});
