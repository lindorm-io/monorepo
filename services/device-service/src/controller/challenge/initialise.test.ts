import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import { createTestChallengeSession, createTestDeviceLink } from "../../fixtures/entity";
import { getDeviceHeaders as _getDeviceHeaders } from "../../handler";
import { initialiseChallengeController } from "./initialise";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/random", () => ({
  ...(jest.requireActual("@lindorm-io/random") as object),

  randomString: () => "random-value",
}));
jest.mock("../../handler");

const getDeviceHeaders = _getDeviceHeaders as jest.Mock;

describe("initialiseChallengeController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      redis: {
        challengeSessionCache: createMockRedisRepository(createTestChallengeSession),
      },
      data: {
        audiences: ["bcfcc919-b9af-4d4e-a9db-d35059994f22"],
        identityId: "9ced984c-1fbc-4ee8-af63-f8248576c660",
        nonce: "18455aba1b024f4e",
        payload: { test: true },
        scopes: ["test_scope"],
      },
      entity: {
        deviceLink: createTestDeviceLink({
          id: "2b16e7e6-8e88-4b5f-b667-e4b52b9ac853",
          biometry: "biometry-signature",
          identityId: "9ced984c-1fbc-4ee8-af63-f8248576c660",
          installationId: "b75393fd-2cdf-449a-810f-b14c0d11e871",
          pincode: "pincode-signature",
          uniqueId: "474aacfa09474d4caaf903977b896213",
        }),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({
          token: "jwt.jwt.jwt",
        })),
      },
    };

    getDeviceHeaders.mockReturnValue({
      installationId: "b75393fd-2cdf-449a-810f-b14c0d11e871",
      linkId: "2b16e7e6-8e88-4b5f-b667-e4b52b9ac853",
      name: "name",
      systemVersion: "1.0.0",
      uniqueId: "474aacfa09474d4caaf903977b896213",
    });
  });

  test("should resolve challenge session", async () => {
    await expect(initialiseChallengeController(ctx)).resolves.toStrictEqual({
      body: {
        certificateChallenge: "random-value",
        challengeSessionId: expect.any(String),
        challengeSessionToken: "jwt.jwt.jwt",
        expires: "2021-01-01T08:05:00.000Z",
        strategies: ["implicit", "biometry", "pincode"],
      },
    });

    expect(ctx.jwt.sign).toHaveBeenCalled();

    expect(ctx.redis.challengeSessionCache.create).toHaveBeenCalled();
  });
});
