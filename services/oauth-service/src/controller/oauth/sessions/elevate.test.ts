import MockDate from "mockdate";
import { SessionHint } from "../../../enum";
import { createMockCache } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestClient, createTestElevationSession } from "../../../fixtures/entity";
import { elevateController } from "./elevate";
import { getUnixTime } from "date-fns";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("elevateController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        elevationSessionCache: createMockCache(createTestElevationSession),
      },
      data: {
        acrValue: 4,
        amrValues: ["phone"],
        country: "dk",
        uiLocales: ["da-DK"],
      },
      entity: {
        client: createTestClient(),
      },
      token: {
        bearerToken: {
          authTime: getUnixTime(new Date("2021-01-01T04:00:00.000Z")),
          levelOfAssurance: 1,
          sessionId: "e9c91056-01e8-4396-bc60-e231ad743688",
          sessionHint: SessionHint.BROWSER,
          subject: "87ab1777-f01a-468f-a68f-1c5737064811",
        },
        idToken: {
          authMethodsReference: ["email"],
          levelOfAssurance: 2,
          nonce: "QxEQ4H21R-gslTwr",
          token: "id.jwt.jwt",
          claims: {
            email: "test@email.com",
            phoneNumber: "+4520123456",
            username: "username",
          },
        },
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(elevateController(ctx)).resolves.toStrictEqual({
      body: { elevationSessionId: expect.any(String) },
    });

    expect(ctx.cache.elevationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedAuthentication: {
          acrValues: [],
          amrValues: [],
          latestAuthentication: null,
          levelOfAssurance: 0,
        },
        identifiers: {
          browserSessionId: "e9c91056-01e8-4396-bc60-e231ad743688",
          refreshSessionId: null,
        },
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 2,
          recommendedMethods: ["email"],
          requiredLevel: 4,
          requiredMethods: ["phone"],
        },

        authenticationHint: expect.arrayContaining(["test@email.com", "+4520123456", "username"]),
        country: "dk",
        idTokenHint: "id.jwt.jwt",
        identityId: "87ab1777-f01a-468f-a68f-1c5737064811",
        nonce: "QxEQ4H21R-gslTwr",
        status: "pending",
        uiLocales: ["da-DK"],
      }),
    );
  });
});
