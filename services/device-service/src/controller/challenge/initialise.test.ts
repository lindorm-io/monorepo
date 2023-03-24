import MockDate from "mockdate";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestChallengeSession, createTestDeviceLink } from "../../fixtures/entity";
import { initialiseChallengeController } from "./initialise";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/random", () => ({
  ...(jest.requireActual("@lindorm-io/random") as object),

  randomString: () => "random-value",
}));

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
        deviceLink: await createTestDeviceLink({
          id: "524e8022-864c-4fca-a6d0-38042f69e3a9",
          biometry: "biometry-signature",
          identityId: "9ced984c-1fbc-4ee8-af63-f8248576c660",
          installationId: "831a4227-db62-4160-97be-65c22023e367",
          pincode: "pincode-signature",
          uniqueId: "02aea6d6-db65-4ab9-ad0f-812cf0236b6f",
        }),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({
          token: "jwt.jwt.jwt",
        })),
      },
      metadata: {
        device: {
          installationId: "831a4227-db62-4160-97be-65c22023e367",
          linkId: "524e8022-864c-4fca-a6d0-38042f69e3a9",
          uniqueId: "02aea6d6-db65-4ab9-ad0f-812cf0236b6f",
        },
      },
    };
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
