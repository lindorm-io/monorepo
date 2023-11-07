import { ServerError } from "@lindorm-io/errors";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestFederationSession } from "../fixtures/entity";
import { verifyFederationWithCode } from "./verify-federation-with-code";

describe("verifyFederationWithCode", () => {
  let ctx: any;
  let federationSession: any;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          post: jest.fn().mockResolvedValue({ data: { accessToken: "jwt.jwt.jwt" } }),
          get: jest.fn().mockResolvedValue({ data: { sub: "sub", claim: true } }),
        },
      },
      logger: createMockLogger(),
    };

    federationSession = createTestFederationSession();
  });

  test("should resolve", async () => {
    await expect(verifyFederationWithCode(ctx, federationSession, "code")).resolves.toStrictEqual({
      sub: "sub",
      claim: true,
    });
  });

  test("should throw on invalid provider", async () => {
    federationSession = createTestFederationSession({
      provider: "wrong",
    });

    await expect(verifyFederationWithCode(ctx, federationSession, "code")).rejects.toThrow(
      ServerError,
    );
  });
});
