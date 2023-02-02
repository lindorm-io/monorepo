import { getOidcSessionController } from "./get-oidc-session";
import { createTestOidcSession } from "../../fixtures/entity";

describe("getOidcSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        oidcSession: createTestOidcSession({
          callbackId: "callbackId",
          identityId: "identity",
          verified: true,
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getOidcSessionController(ctx)).resolves.toStrictEqual({
      body: {
        callbackId: "callbackId",
        identityId: "identity",
        levelOfAssurance: 2,
        provider: "apple",
      },
    });
  });
});
