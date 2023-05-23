import { AuthenticationMethod } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { ElevationRequest } from "../../entity";
import { createTestClientSession, createTestElevationRequest } from "../../fixtures/entity";
import { updateClientSessionElevation } from "./update-client-session-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

describe("verifyClientSessionElevation", () => {
  let ctx: any;
  let elevationRequest: ElevationRequest;

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

    elevationRequest = createTestElevationRequest({
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

    await expect(updateClientSessionElevation(ctx, elevationRequest)).resolves.toBeUndefined();

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

    await expect(updateClientSessionElevation(ctx, elevationRequest)).rejects.toThrow(ServerError);
  });
});
