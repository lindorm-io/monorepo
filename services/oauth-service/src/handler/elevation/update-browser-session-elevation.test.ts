import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { ServerError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { ElevationSession } from "../../entity";
import { createTestBrowserSession, createTestElevationSession } from "../../fixtures/entity";
import { getBrowserSessionCookies as _getBrowserSessionCookies } from "../cookies";
import { updateBrowserSessionElevation } from "./update-browser-session-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../cookies");

const getBrowserSessionCookies = _getBrowserSessionCookies as jest.Mock;

describe("updateBrowserSessionElevation", () => {
  let ctx: any;
  let elevationSession: ElevationSession;

  beforeEach(() => {
    ctx = {
      mongo: {
        browserSessionRepository: createMockMongoRepository(createTestBrowserSession),
      },
      server: {
        environment: "development",
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

      browserSessionId: "06715391-bea3-47db-acf4-ffa1f500bcc8",
      clientSessionId: null,

      identityId: "7a658184-a059-478d-a003-9a50c411ef64",
    });

    getBrowserSessionCookies.mockImplementation(() => ["06715391-bea3-47db-acf4-ffa1f500bcc8"]);
  });

  test("should resolve", async () => {
    ctx.mongo.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        id: "06715391-bea3-47db-acf4-ffa1f500bcc8",
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2021-01-01T04:00:00.000Z"),
        levelOfAssurance: 2,
        methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      }),
    );

    await expect(updateBrowserSessionElevation(ctx, elevationSession)).resolves.toBeUndefined();

    expect(ctx.mongo.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        factors: [
          AuthenticationFactor.TWO_FACTOR,
          AuthenticationFactor.PHISHING_RESISTANT_HARDWARE,
        ],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [
          AuthenticationMethod.BANK_ID_SE,
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
        ],
        strategies: [
          AuthenticationStrategy.BANK_ID_SE,
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.PHONE_OTP,
        ],
      }),
    );
  });

  test("should throw on invalid session id", async () => {
    ctx.mongo.browserSessionRepository.find.mockResolvedValue(createTestBrowserSession());

    await expect(updateBrowserSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });

  test("should throw on invalid identity", async () => {
    ctx.mongo.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({ id: "06715391-bea3-47db-acf4-ffa1f500bcc8" }),
    );

    await expect(updateBrowserSessionElevation(ctx, elevationSession)).rejects.toThrow(ServerError);
  });
});
