import { ServerError } from "@lindorm-io/errors";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestFederationSession } from "../fixtures/entity";
import { verifyFederationWithIdToken } from "./verify-federation-with-id-token";

describe("verifyFederationWithIdToken", () => {
  let ctx: any;
  let federationSession: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        verify: jest
          .fn()
          .mockImplementation(() => ({ subject: "sub", claims: { given_name: "given" } })),
      },
      logger: createMockLogger(),
    };

    federationSession = createTestFederationSession();
  });

  test("should resolve", async () => {
    await expect(
      verifyFederationWithIdToken(ctx, federationSession, "code"),
    ).resolves.toStrictEqual({
      sub: "sub",
      given_name: "given",
    });
  });

  test("should throw on invalid provider", async () => {
    federationSession = createTestFederationSession({
      provider: "wrong",
    });

    await expect(verifyFederationWithIdToken(ctx, federationSession, "code")).rejects.toThrow(
      ServerError,
    );
  });
});
