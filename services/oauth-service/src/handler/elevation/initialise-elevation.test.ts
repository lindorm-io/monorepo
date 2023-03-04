import MockDate from "mockdate";
import { ElevationSession } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../../util";
import { initialiseElevation } from "./initialise-elevation";
import {
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestElevationSession,
} from "../../fixtures/entity";
import { ClientError } from "@lindorm-io/errors";
import { randomUUID } from "crypto";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../cookies");
jest.mock("../../util");

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
        clientSession: createTestClientSession({
          id: "e9c91056-01e8-4396-bc60-e231ad743688",
          browserSessionId: "45cdaf0a-805c-43c8-9e1f-3b30246e9ab3",
          identityId: "87ab1777-f01a-468f-a68f-1c5737064811",
        }),
      },
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
      },
      token: {
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
  });

  test("should resolve client session for all values", async () => {
    await expect(initialiseElevation(ctx, options)).resolves.toStrictEqual(
      expect.any(ElevationSession),
    );

    expect(ctx.cache.elevationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticationHint: ["+4520123456", "0701234567", "test@email.com", "username"],
        browserSessionId: "45cdaf0a-805c-43c8-9e1f-3b30246e9ab3",
        clientId: "be55601a-8034-4dde-a039-e8a42e8280d9",
        clientSessionId: "e9c91056-01e8-4396-bc60-e231ad743688",
        confirmedAuthentication: {
          latestAuthentication: null,
          levelOfAssurance: 0,
          methods: [],
        },
        country: "dk",
        displayMode: "popup",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: "id.jwt.jwt",
        identityId: "87ab1777-f01a-468f-a68f-1c5737064811",
        nonce: "QxEQ4H21R-gslTwr",
        redirectUri: "https://test.client.lindorm.io/redirect",
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

  test("should resolve client session for minimum values", async () => {
    options = {};
    ctx.token.idToken = undefined;

    await expect(initialiseElevation(ctx, options)).resolves.toStrictEqual(
      expect.any(ElevationSession),
    );

    expect(ctx.cache.elevationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticationHint: [],
        browserSessionId: "45cdaf0a-805c-43c8-9e1f-3b30246e9ab3",
        clientId: "be55601a-8034-4dde-a039-e8a42e8280d9",
        confirmedAuthentication: {
          latestAuthentication: null,
          levelOfAssurance: 0,
          methods: [],
        },
        country: null,
        displayMode: "page",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: null,
        identityId: "87ab1777-f01a-468f-a68f-1c5737064811",
        nonce: expect.any(String),
        redirectUri: null,
        clientSessionId: "e9c91056-01e8-4396-bc60-e231ad743688",
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

  test("should throw on id token mismatch", async () => {
    ctx.token.idToken.session = randomUUID();

    await expect(initialiseElevation(ctx, options)).rejects.toThrow(ClientError);
  });
});
