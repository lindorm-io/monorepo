import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { ServerError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { ElevationSession } from "../../entity";
import { createTestClientSession, createTestElevationSession } from "../../fixtures/entity";
import { updateClientSessionElevation } from "./update-client-session-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

describe("verifyClientSessionElevation", () => {
  let ctx: any;
  let elevationSession: ElevationSession;

  beforeEach(() => {
    ctx = {
      mongo: {
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
      server: {
        environment: "development",
      },
      cookies: {
        get: jest.fn().mockReturnValue("06715391-bea3-47db-acf4-ffa1f500bcc8"),
      },
    };

    elevationSession = createTestElevationSession({
      confirmedAuthentication: {
        factors: [AuthenticationFactor.PHISHING_RESISTANT_HARDWARE],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        metadata: {},
        methods: [AuthenticationMethod.BANK_ID_SE],
        strategies: [AuthenticationStrategy.BANK_ID_SE],
      },

      browserSessionId: null,
      clientSessionId: "06715391-bea3-47db-acf4-ffa1f500bcc8",
      identityId: "7a658184-a059-478d-a003-9a50c411ef64",
    });
  });

  test("should resolve", async () => {
    ctx.mongo.clientSessionRepository.find.mockResolvedValue(
      createTestClientSession({
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2021-01-01T04:00:00.000Z"),
        levelOfAssurance: 2,
        methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      }),
    );

    await expect(updateClientSessionElevation(ctx, elevationSession)).resolves.toBeUndefined();

    expect(ctx.mongo.clientSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        factors: [AuthenticationFactor.PHISHING_RESISTANT_HARDWARE],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [AuthenticationMethod.BANK_ID_SE],
        strategies: [AuthenticationStrategy.BANK_ID_SE],
      }),
    );
  });

  test("should throw on invalid identity", async () => {
    ctx.mongo.clientSessionRepository.find.mockResolvedValue(createTestClientSession());

    await expect(updateClientSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });
});
