import { getTestLoginSession } from "../../test/entity";
import { initialiseOidcController } from "./initialise-oidc";

describe("initialiseOidcController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: {
          update: jest.fn().mockImplementation(async (arg) => arg),
        },
        oidcSessionCache: {
          create: jest.fn().mockImplementation(async (arg) => arg),
        },
      },
      data: {
        identityProvider: "apple",
        remember: true,
      },
      entity: {
        loginSession: getTestLoginSession(),
      },
      setCookie: jest.fn(),
    };
  });

  test("should resolve", async () => {
    await expect(initialiseOidcController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(ctx.cache.loginSessionCache.update).toHaveBeenCalled();
    expect(ctx.cache.oidcSessionCache.create).toHaveBeenCalled();
    expect(ctx.setCookie).toHaveBeenCalled();
  });
});
