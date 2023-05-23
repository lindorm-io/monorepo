import { AuthenticationMethod } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { ElevationRequest } from "../../entity";
import { createTestBrowserSession, createTestElevationRequest } from "../../fixtures/entity";
import { getBrowserSessionCookies as _getBrowserSessionCookies } from "../cookies";
import { updateBrowserSessionElevation } from "./update-browser-session-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../cookies");

const getBrowserSessionCookies = _getBrowserSessionCookies as jest.Mock;

describe("updateBrowserSessionElevation", () => {
  let ctx: any;
  let elevationRequest: ElevationRequest;

  beforeEach(() => {
    ctx = {
      mongo: {
        browserSessionRepository: createMockMongoRepository(createTestBrowserSession),
      },
      server: {
        environment: "development",
      },
    };

    elevationRequest = createTestElevationRequest({
      confirmedAuthentication: {
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [AuthenticationMethod.BANK_ID_SE],
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

    await expect(updateBrowserSessionElevation(ctx, elevationRequest)).resolves.toBeUndefined();

    expect(ctx.mongo.browserSessionRepository.update).toHaveBeenCalledWith(
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

  test("should throw on invalid session id", async () => {
    ctx.mongo.browserSessionRepository.find.mockResolvedValue(createTestBrowserSession());

    await expect(updateBrowserSessionElevation(ctx, elevationRequest)).rejects.toThrow(ServerError);
  });

  test("should throw on invalid identity", async () => {
    ctx.mongo.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({ id: "06715391-bea3-47db-acf4-ffa1f500bcc8" }),
    );

    await expect(updateBrowserSessionElevation(ctx, elevationRequest)).rejects.toThrow(ServerError);
  });
});
