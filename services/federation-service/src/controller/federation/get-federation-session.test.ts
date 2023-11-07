import { createTestFederationSession } from "../../fixtures/entity";
import { getFederationSessionController } from "./get-federation-session";

describe("getFederationSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        federationSession: createTestFederationSession({
          callbackId: "callbackId",
          identityId: "identity",
          verified: true,
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getFederationSessionController(ctx)).resolves.toStrictEqual({
      body: {
        callbackId: "callbackId",
        identityId: "identity",
        levelOfAssurance: 2,
        provider: "apple",
      },
    });
  });
});
