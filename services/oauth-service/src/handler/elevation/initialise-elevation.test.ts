import MockDate from "mockdate";
import { ElevationSession } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../../util";
import { getBrowserSessionCookies as _getBrowserSessionCookies } from "../cookies";
import { getUnixTime } from "date-fns";
import { initialiseElevation } from "./initialise-elevation";
import {
  createTestAccessSession,
  createTestBrowserSession,
  createTestClient,
  createTestElevationSession,
  createTestRefreshSession,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../cookies");
jest.mock("../../util");

const getBrowserSessionCookies = _getBrowserSessionCookies as jest.Mock;
const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;

describe("initialiseElevation", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      cache: {
        elevationSessionCache: createMockCache(createTestElevationSession),
      },
      entity: {
        client: createTestClient({
          id: "be55601a-8034-4dde-a039-e8a42e8280d9",
        }),
      },
      repository: {
        accessSessionRepository: createMockRepository(createTestAccessSession),
        browserSessionRepository: createMockRepository(createTestBrowserSession),
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
      token: {
        bearerToken: {
          authTime: getUnixTime(new Date("2021-01-01T04:00:00.000Z")),
          client: "be55601a-8034-4dde-a039-e8a42e8280d9",
          levelOfAssurance: 1,
          session: "e9c91056-01e8-4396-bc60-e231ad743688",
          sessionHint: "access",
          subject: "87ab1777-f01a-468f-a68f-1c5737064811",
        },
        idToken: {
          authMethodsReference: ["email"],
          client: "be55601a-8034-4dde-a039-e8a42e8280d9",
          levelOfAssurance: 2,
          nonce: "QxEQ4H21R-gslTwr",
          session: "e9c91056-01e8-4396-bc60-e231ad743688",
          sessionHint: "access",
          token: "id.jwt.jwt",
          claims: {
            email: "test@email.com",
            phoneNumber: "+4520123456",
            username: "username",
          },
        },
      },
    };

    options = {
      authenticationHint: "0701234567",
      country: "dk",
      display: "popup",
      levelOfAssurance: 4,
      methods: ["phone"],
      nonce: "QxEQ4H21R-gslTwr",
      redirectUri: "https://test.client.lindorm.io/redirect",
      state: "l7wj9qEP90kfbAGa",
      uiLocales: ["da-DK"],
    };

    getAdjustedAccessLevel.mockImplementation(() => 2);
    getBrowserSessionCookies.mockImplementation(() => []);
  });

  test("should resolve access session for all values", async () => {
    ctx.repository.accessSessionRepository.find.mockResolvedValue(
      createTestAccessSession({
        browserSessionId: "b66cde9c-4f14-4f1a-af08-a53ccf684cd8",
      }),
    );

    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({ id: "b66cde9c-4f14-4f1a-af08-a53ccf684cd8" }),
    );

    getBrowserSessionCookies.mockImplementation(() => ["b66cde9c-4f14-4f1a-af08-a53ccf684cd8"]);

    await expect(initialiseElevation(ctx, options)).resolves.toStrictEqual(
      expect.any(ElevationSession),
    );

    expect(ctx.cache.elevationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accessSessionId: expect.any(String),
        authenticationHint: ["+4520123456", "0701234567", "test@email.com", "username"],
        browserSessionId: "b66cde9c-4f14-4f1a-af08-a53ccf684cd8",
        clientId: "be55601a-8034-4dde-a039-e8a42e8280d9",
        confirmedAuthentication: {
          latestAuthentication: null,
          levelOfAssurance: 0,
          methods: [],
        },
        country: "dk",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: "id.jwt.jwt",
        identityId: "87ab1777-f01a-468f-a68f-1c5737064811",
        nonce: "QxEQ4H21R-gslTwr",
        redirectUri: "https://test.client.lindorm.io/redirect",
        refreshSessionId: null,
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 2,
          recommendedMethods: ["email"],
          requiredLevel: 4,
          requiredMethods: ["phone"],
        },
        state: "l7wj9qEP90kfbAGa",
        status: "pending",
        uiLocales: ["da-DK"],
      }),
    );
  });

  test("should resolve refresh session for minimum values", async () => {
    options = {};
    ctx.token.bearerToken.sessionHint = "refresh";
    ctx.token.idToken = undefined;

    await expect(initialiseElevation(ctx, options)).resolves.toStrictEqual(
      expect.any(ElevationSession),
    );

    expect(ctx.cache.elevationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accessSessionId: null,
        authenticationHint: [],
        browserSessionId: null,
        clientId: "be55601a-8034-4dde-a039-e8a42e8280d9",
        confirmedAuthentication: {
          latestAuthentication: null,
          levelOfAssurance: 0,
          methods: [],
        },
        country: null,
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: null,
        identityId: "87ab1777-f01a-468f-a68f-1c5737064811",
        nonce: expect.any(String),
        redirectUri: null,
        refreshSessionId: expect.any(String),
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 1,
          recommendedMethods: [],
          requiredLevel: 1,
          requiredMethods: [],
        },
        state: null,
        status: "pending",
        uiLocales: [],
      }),
    );
  });
});
