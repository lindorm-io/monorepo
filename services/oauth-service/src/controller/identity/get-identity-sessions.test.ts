import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestClient, createTestClientSession, createTestTenant } from "../../fixtures/entity";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../../util";
import { getIdentitySessionsController } from "./get-identity-sessions";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;

describe("getIdentitySessions", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "identityId",
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
        clientSessionRepository: {
          findMany: jest.fn().mockResolvedValue([
            createTestClientSession({
              id: "bd672cb2-669c-4519-9ba1-5850e8974e19",
              levelOfAssurance: 1,
            }),
            createTestClientSession({
              id: "e1e16e28-28f5-4357-baee-2251e6a746b2",
              levelOfAssurance: 2,
            }),
            createTestClientSession({
              id: "abc98c7d-c557-424e-a810-eb2cd138b7df",
              levelOfAssurance: 3,
            }),
            createTestClientSession({
              id: "5a0ded8b-3f6e-4b4a-aea5-7ecf5ddbb676",
              levelOfAssurance: 4,
            }),
          ]),
        },
        tenantRepository: createMockMongoRepository(createTestTenant),
      },
    };

    getAdjustedAccessLevel.mockReturnValue(1);
  });

  test("should resolve sessions", async () => {
    await expect(getIdentitySessionsController(ctx)).resolves.toStrictEqual({
      body: {
        sessions: [
          {
            id: "bd672cb2-669c-4519-9ba1-5850e8974e19",
            adjustedAccessLevel: 1,
            factors: [AuthenticationFactor.TWO_FACTOR],
            latestAuthentication: "2021-01-01T07:59:00.000Z",
            levelOfAssurance: 1,
            metadata: {
              deviceName: "Test Device",
              ip: "10.0.0.1",
              platform: "iOS",
            },
            methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
            scopes: ["openid", "profile"],
            strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
            type: "refresh",

            client: {
              id: expect.any(String),
              name: "ClientName",
              logoUri: "https://logo.uri/logo",
              singleSignOn: true,
              type: "confidential",
            },

            tenant: {
              id: expect.any(String),
              name: "TenantName",
            },
          },
          {
            id: "e1e16e28-28f5-4357-baee-2251e6a746b2",
            adjustedAccessLevel: 1,
            factors: [AuthenticationFactor.TWO_FACTOR],
            latestAuthentication: "2021-01-01T07:59:00.000Z",
            levelOfAssurance: 2,
            metadata: {
              deviceName: "Test Device",
              ip: "10.0.0.1",
              platform: "iOS",
            },
            methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
            scopes: ["openid", "profile"],
            strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
            type: "refresh",

            client: {
              id: expect.any(String),
              name: "ClientName",
              logoUri: "https://logo.uri/logo",
              singleSignOn: true,
              type: "confidential",
            },

            tenant: {
              id: expect.any(String),
              name: "TenantName",
            },
          },
          {
            id: "abc98c7d-c557-424e-a810-eb2cd138b7df",
            adjustedAccessLevel: 1,
            factors: [AuthenticationFactor.TWO_FACTOR],
            latestAuthentication: "2021-01-01T07:59:00.000Z",
            levelOfAssurance: 3,
            metadata: {
              deviceName: "Test Device",
              ip: "10.0.0.1",
              platform: "iOS",
            },
            methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
            scopes: ["openid", "profile"],
            strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
            type: "refresh",

            client: {
              id: expect.any(String),
              name: "ClientName",
              logoUri: "https://logo.uri/logo",
              singleSignOn: true,
              type: "confidential",
            },

            tenant: {
              id: expect.any(String),
              name: "TenantName",
            },
          },
          {
            id: "5a0ded8b-3f6e-4b4a-aea5-7ecf5ddbb676",
            adjustedAccessLevel: 1,
            factors: [AuthenticationFactor.TWO_FACTOR],
            latestAuthentication: "2021-01-01T07:59:00.000Z",
            levelOfAssurance: 4,
            metadata: {
              deviceName: "Test Device",
              ip: "10.0.0.1",
              platform: "iOS",
            },
            methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
            scopes: ["openid", "profile"],
            strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
            type: "refresh",

            client: {
              id: expect.any(String),
              name: "ClientName",
              logoUri: "https://logo.uri/logo",
              singleSignOn: true,
              type: "confidential",
            },

            tenant: {
              id: expect.any(String),
              name: "TenantName",
            },
          },
        ],
      },
    });
  });
});
