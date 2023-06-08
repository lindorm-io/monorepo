import { decodeOpaqueToken as _decodeOpaqueToken } from "@lindorm-io/jwt";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestAuthenticationConfirmationToken } from "../../../fixtures/entity";
import { confirmOauthElevation as _confirmOauthElevation } from "../../../handler";
import { confirmElevationSessionController } from "./confirm-elevation-session";

jest.mock("@lindorm-io/jwt");
jest.mock("../../../handler");

const confirmOauthElevation = _confirmOauthElevation as jest.Mock;
const decodeOpaqueToken = _decodeOpaqueToken as jest.Mock;

describe("confirmElevationSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        authenticationToken: "authenticationToken",
      },
      redis: {
        authenticationConfirmationTokenCache: createMockRedisRepository((args) =>
          createTestAuthenticationConfirmationToken({ ...args, signature: "signature" }),
        ),
      },
    };

    confirmOauthElevation.mockResolvedValue({ redirectTo: "confirmOauthElevation" });
    decodeOpaqueToken.mockReturnValue({ id: "id", signature: "signature" });
  });

  test("should resolve", async () => {
    await expect(confirmElevationSessionController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "confirmOauthElevation" },
    });
  });
});
