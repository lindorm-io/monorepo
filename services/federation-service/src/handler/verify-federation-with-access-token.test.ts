import { ServerError } from "@lindorm-io/errors";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestFederationSession } from "../fixtures/entity";
import { verifyFederationWithAccessToken } from "./verify-federation-with-access-token";

describe("verifyFederationWithAccessToken", () => {
  let ctx: any;
  let federationSession: any;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          get: jest.fn().mockResolvedValue({ data: { sub: "sub", claim: true } }),
        },
      },
      logger: createMockLogger(),
    };

    federationSession = createTestFederationSession();
  });

  test("should resolve", async () => {
    await expect(
      verifyFederationWithAccessToken(ctx, federationSession, "jwt.jwt.jwt"),
    ).resolves.toStrictEqual({ sub: "sub", claim: true });
  });

  test("should throw on invalid provider", async () => {
    federationSession = createTestFederationSession({
      provider: "wrong",
    });

    await expect(
      verifyFederationWithAccessToken(ctx, federationSession, "jwt.jwt.jwt"),
    ).rejects.toThrow(ServerError);
  });
});
