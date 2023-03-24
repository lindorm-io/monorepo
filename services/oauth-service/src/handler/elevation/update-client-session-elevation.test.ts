import MockDate from "mockdate";
import { ElevationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestClientSession, createTestElevationSession } from "../../fixtures/entity";
import { updateClientSessionElevation } from "./update-client-session-elevation";
import { AuthenticationMethod } from "@lindorm-io/common-types";

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
        get: jest.fn().mockImplementation(() => "06715391-bea3-47db-acf4-ffa1f500bcc8"),
      },
    };

    elevationSession = createTestElevationSession({
      confirmedAuthentication: {
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [AuthenticationMethod.BANK_ID_SE],
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
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [
          AuthenticationMethod.BANK_ID_SE,
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
        ],
      }),
    );
  });

  test("should throw on invalid identity", async () => {
    ctx.mongo.clientSessionRepository.find.mockResolvedValue(createTestClientSession());

    await expect(updateClientSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });
});
