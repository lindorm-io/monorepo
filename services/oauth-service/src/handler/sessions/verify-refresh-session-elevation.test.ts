import MockDate from "mockdate";
import { ElevationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestElevationSession, createTestRefreshSession } from "../../fixtures/entity";
import { verifyRefreshSessionElevation } from "./verify-refresh-session-elevation";
import { AuthenticationMethod } from "../../common";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

describe("verifyRefreshSessionElevation", () => {
  let ctx: any;
  let elevationSession: ElevationSession;

  beforeEach(() => {
    ctx = {
      repository: {
        refreshSessionRepository: createMockRepository((opts) =>
          createTestRefreshSession({
            identityId: "7a658184-a059-478d-a003-9a50c411ef64",
            latestAuthentication: new Date("2021-01-01T04:00:00.000Z"),
            ...opts,
          }),
        ),
      },
      metadata: {
        environment: "development",
      },
      cookies: {
        get: jest.fn().mockImplementation(() => "06715391-bea3-47db-acf4-ffa1f500bcc8"),
      },
    };

    elevationSession = createTestElevationSession({
      confirmedAuthentication: {
        acrValues: ["loa_4"],
        amrValues: [AuthenticationMethod.BANK_ID_SE],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
      },
      identifiers: {
        browserSessionId: null,
        refreshSessionId: "06715391-bea3-47db-acf4-ffa1f500bcc8",
      },
      identityId: "7a658184-a059-478d-a003-9a50c411ef64",
    });
  });

  test("should resolve", async () => {
    await expect(verifyRefreshSessionElevation(ctx, elevationSession)).resolves.toBeUndefined();

    expect(ctx.repository.refreshSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        acrValues: ["loa_4"],
        amrValues: ["bank_id_se"],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
      }),
    );
  });

  test("should throw on invalid identity", async () => {
    elevationSession = createTestElevationSession({
      ...elevationSession,
      identityId: "4aea4484-bf31-474d-84be-b5ac09097992",
    });

    await expect(verifyRefreshSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });
});
