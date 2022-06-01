import { getOidcSessionController } from "./get-oidc-session";
import { getTestOidcSession } from "../../test/entity";

describe("getOidcSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        oidcSession: getTestOidcSession({
          identityId: "identity",
          verified: true,
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getOidcSessionController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "identity",
        provider: "apple",
      },
    });
  });
});
