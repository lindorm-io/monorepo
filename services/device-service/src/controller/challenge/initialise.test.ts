import MockDate from "mockdate";
import { createMockCache } from "@lindorm-io/redis";
import { createTestChallengeSession, createTestDeviceLink } from "../../fixtures/entity";
import { initialiseChallengeController } from "./initialise";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/core", () => ({
  ...(jest.requireActual("@lindorm-io/core") as object),
  getRandomString: () => "random-value",
}));

describe("initialiseChallengeController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      cache: {
        challengeSessionCache: createMockCache(createTestChallengeSession),
      },
      data: {
        clientId: "bcfcc919-b9af-4d4e-a9db-d35059994f22",
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
      metadata: {
        client: {
          id: "5e8a2502-915f-4eed-b72f-665d5ac1458c",
        },
      },
    };
  });

  test("should resolve challenge session", async () => {
    await expect(initialiseChallengeController(ctx)).resolves.toStrictEqual({
      body: {
        certificateChallenge: "random-value",
        challengeSessionToken: "jwt.jwt.jwt",
        expiresIn: 300,
        strategies: ["implicit", "biometry", "pincode"],
      },
    });

    expect(ctx.jwt.sign).toHaveBeenCalled();

    expect(ctx.cache.challengeSessionCache.create).toHaveBeenCalled();
  });
});
