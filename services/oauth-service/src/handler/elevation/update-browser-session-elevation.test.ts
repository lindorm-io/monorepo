import MockDate from "mockdate";
import { ElevationSession } from "../../entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestBrowserSession, createTestElevationSession } from "../../fixtures/entity";
import { getBrowserSessionCookies as _getBrowserSessionCookies } from "../cookies";
import { updateBrowserSessionElevation } from "./update-browser-session-elevation";
import { ServerError } from "@lindorm-io/errors";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../cookies");

const getBrowserSessionCookies = _getBrowserSessionCookies as jest.Mock;

describe("updateBrowserSessionElevation", () => {
  let ctx: any;
  let elevationSession: ElevationSession;

  beforeEach(() => {
    ctx = {
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
      },
      server: {
        environment: "development",
      },
    };

    elevationSession = createTestElevationSession({
      confirmedAuthentication: {
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: ["bank_id_se"],
      },

      accessSessionId: null,
      browserSessionId: "06715391-bea3-47db-acf4-ffa1f500bcc8",
      refreshSessionId: null,

      identityId: "7a658184-a059-478d-a003-9a50c411ef64",
    });

    getBrowserSessionCookies.mockImplementation(() => ["06715391-bea3-47db-acf4-ffa1f500bcc8"]);
  });

  test("should resolve", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        id: "06715391-bea3-47db-acf4-ffa1f500bcc8",
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2021-01-01T04:00:00.000Z"),
        levelOfAssurance: 2,
        methods: ["email", "phone"],
      }),
    );

    await expect(updateBrowserSessionElevation(ctx, elevationSession)).resolves.toBeUndefined();

    expect(ctx.repository.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: ["bank_id_se", "email", "phone"],
      }),
    );
  });

  test("should throw on invalid session id", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(createTestBrowserSession());

    await expect(updateBrowserSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });

  test("should throw on invalid identity", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({ id: "06715391-bea3-47db-acf4-ffa1f500bcc8" }),
    );

    await expect(updateBrowserSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });
});
