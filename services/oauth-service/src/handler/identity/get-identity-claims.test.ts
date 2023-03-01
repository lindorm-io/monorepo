import { TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import { getIdentityClaims } from "./get-identity-claims";
import {
  createTestAccessSession,
  createTestClaimsSession,
  createTestClient,
} from "../../fixtures/entity";
import { createMockCache } from "@lindorm-io/redis";
import { generateServerCredentialsToken as _generateServerCredentialsToken } from "../token";

jest.mock("../token");

const generateServerCredentialsToken = _generateServerCredentialsToken as jest.Mock;

describe("getIdentityClaims", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          get: jest.fn().mockResolvedValue({
            data: { clientClaim: "clientClaim" },
          }),
        },
        identityClient: {
          get: jest.fn().mockResolvedValue({
            data: TEST_GET_USERINFO_RESPONSE,
          }),
        },
      },
      cache: {
        claimsSessionCache: createMockCache(createTestClaimsSession),
      },
    };

    generateServerCredentialsToken.mockImplementation(() => "bearerToken");
  });

  test("should resolve", async () => {
    await expect(
      getIdentityClaims(ctx, createTestClient(), createTestAccessSession()),
    ).resolves.toMatchSnapshot();

    expect(ctx.cache.claimsSessionCache.create).toHaveBeenCalled();
    expect(ctx.axios.axiosClient.get).toHaveBeenCalled();
    expect(ctx.axios.identityClient.get).toHaveBeenCalled();
    expect(ctx.cache.claimsSessionCache.destroy).toHaveBeenCalled();
  });
});
