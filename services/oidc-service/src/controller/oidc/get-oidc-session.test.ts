import { getOidcSessionController } from "./get-oidc-session";
import { createTestOidcSession } from "../../fixtures/entity";

describe("getOidcSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        oidcSession: createTestOidcSession({
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
