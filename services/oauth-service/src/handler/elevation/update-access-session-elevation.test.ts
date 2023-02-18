import MockDate from "mockdate";
import { ElevationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestElevationSession, createTestAccessSession } from "../../fixtures/entity";
import { updateAccessSessionElevation } from "./update-access-session-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

describe("updateAccessSessionElevation", () => {
  let ctx: any;
  let elevationSession: ElevationSession;

  beforeEach(() => {
    ctx = {
      repository: {
        accessSessionRepository: createMockRepository(createTestAccessSession),
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
        methods: ["bank_id_se"],
      },

      accessSessionId: "06715391-bea3-47db-acf4-ffa1f500bcc8",
      browserSessionId: null,
      identityId: "7a658184-a059-478d-a003-9a50c411ef64",
      refreshSessionId: null,
    });
  });

  test("should resolve", async () => {
    ctx.repository.accessSessionRepository.find.mockResolvedValue(
      createTestAccessSession({
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2021-01-01T04:00:00.000Z"),
        levelOfAssurance: 2,
        methods: ["email", "phone"],
      }),
    );

    await expect(updateAccessSessionElevation(ctx, elevationSession)).resolves.toBeUndefined();

    expect(ctx.repository.accessSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: ["bank_id_se", "email", "phone"],
      }),
    );
  });

  test("should throw on invalid identity", async () => {
    ctx.repository.accessSessionRepository.find.mockResolvedValue(createTestAccessSession());

    await expect(updateAccessSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });
});
