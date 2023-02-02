import MockDate from "mockdate";
import { createMockCache } from "@lindorm-io/redis";
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
      cache: {
        challengeSessionCache: createMockCache(createTestChallengeSession),
      },
      data: {
        audiences: ["bcfcc919-b9af-4d4e-a9db-d35059994f22"],
        nonce: "18455aba1b024f4e",
        payload: { test: true },
        scopes: ["test_scope"],
      },
      entity: {
        deviceLink: await createTestDeviceLink({
          pincode: "pincode-signature",
          biometry: "biometry-signature",
        }),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({
          token: "jwt.jwt.jwt",
        })),
      },
    };
  });

  test("should resolve challenge session", async () => {
    await expect(initialiseChallengeController(ctx)).resolves.toStrictEqual({
      body: {
        certificateChallenge: "random-value",
        challengeSessionId: expect.any(String),
        challengeSessionToken: "jwt.jwt.jwt",
        expiresIn: 300,
        strategies: ["implicit", "biometry", "pincode"],
      },
    });

    expect(ctx.jwt.sign).toHaveBeenCalled();

    expect(ctx.cache.challengeSessionCache.create).toHaveBeenCalled();
  });
});
