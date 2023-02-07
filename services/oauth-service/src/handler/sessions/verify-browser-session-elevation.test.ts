import MockDate from "mockdate";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestBrowserSession, createTestElevationSession } from "../../fixtures/entity";
import { verifyBrowserSessionElevation } from "./verify-browser-session-elevation";
import { setBrowserSessionCookie as _setBrowserSessionCookie } from "../cookies";
import { ElevationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");
jest.mock("../cookies");

const setBrowserSessionCookie = _setBrowserSessionCookie as jest.Mock;

describe("verifyBrowserSessionElevation", () => {
  let ctx: any;
  let elevationSession: ElevationSession;

  beforeEach(() => {
    ctx = {
      repository: {
        browserSessionRepository: createMockRepository((opts) =>
          createTestBrowserSession({
            identityId: "7a658184-a059-478d-a003-9a50c411ef64",
            latestAuthentication: new Date("2021-01-01T04:00:00.000Z"),
            remember: false,
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
        amrValues: ["bank_id_se"],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
      },
      identifiers: {
        browserSessionId: "06715391-bea3-47db-acf4-ffa1f500bcc8",
        refreshSessionId: null,
      },
      identityId: "7a658184-a059-478d-a003-9a50c411ef64",
    });

    setBrowserSessionCookie.mockImplementation();
  });

  test("should resolve", async () => {
    await expect(verifyBrowserSessionElevation(ctx, elevationSession)).resolves.toBeUndefined();

    expect(ctx.repository.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        acrValues: ["loa_4"],
        amrValues: ["bank_id_se"],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
      }),
    );
    expect(setBrowserSessionCookie).toHaveBeenCalled();
  });

  test("should throw on missing cookie id", async () => {
    ctx.cookies.get.mockImplementation(() => {});

    await expect(verifyBrowserSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });

  test("should throw on missing cookie id", async () => {
    ctx.cookies.get.mockImplementation(() => "wrong");

    await expect(verifyBrowserSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });

  test("should throw on invalid identity", async () => {
    elevationSession = createTestElevationSession({
      ...elevationSession,
      identityId: "4aea4484-bf31-474d-84be-b5ac09097992",
    });

    await expect(verifyBrowserSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });
});
