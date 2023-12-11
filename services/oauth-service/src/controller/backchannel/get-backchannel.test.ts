import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import MockDate from "mockdate";
import { createTestClient, createTestTenant } from "../../fixtures/entity";
import { createTestBackchannelSession } from "../../fixtures/entity/create-test-backchannel-session";
import { getBackchannelController } from "./get-backchannel";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getBackchannelController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        backchannelSession: createTestBackchannelSession({
          id: "bd959ef1-6782-46ea-baff-2eabad97d967",
          requestedConsent: {
            audiences: ["fecdd5e7-6e6c-4bc7-8473-e87f8a1d13db"],
            scopes: [
              Scope.ADDRESS,
              Scope.EMAIL,
              Scope.OFFLINE_ACCESS,
              Scope.OPENID,
              Scope.PHONE,
              Scope.PROFILE,
            ],
          },
          requestedLogin: {
            factors: [AuthenticationFactor.TWO_FACTOR],
            identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
            levelOfAssurance: 4,
            methods: [AuthenticationMethod.EMAIL],
            minimumLevelOfAssurance: 2,
            strategies: [AuthenticationStrategy.PHONE_OTP],
          },
          status: {
            consent: SessionStatus.PENDING,
            login: SessionStatus.PENDING,
          },
          clientId: "db5c195a-1c0b-41b2-b047-94c13a7dd30d",
        }),
        client: createTestClient({
          id: "db5c195a-1c0b-41b2-b047-94c13a7dd30d",
        }),
        tenant: createTestTenant({
          id: "9e3d1333-efa1-4160-bbcc-ad8fe550f442",
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getBackchannelController(ctx)).resolves.toStrictEqual({
      body: {
        consent: {
          isRequired: true,
          status: "pending",

          audiences: ["fecdd5e7-6e6c-4bc7-8473-e87f8a1d13db"],
          optionalScopes: ["address", "email", "phone", "profile"],
          requiredScopes: ["offline_access", "openid"],
          scopeDescriptions: [
            { name: "openid", description: "Give the client access to your OpenID claims." },
            { name: "profile", description: "Give the client access to your profile information." },
          ],
        },

        login: {
          isRequired: true,
          status: "pending",

          factors: [AuthenticationFactor.TWO_FACTOR],
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          levelOfAssurance: 4,
          methods: [AuthenticationMethod.EMAIL],
          minimumLevelOfAssurance: 2,
          strategies: [AuthenticationStrategy.PHONE_OTP],
        },

        backchannelSession: {
          id: "bd959ef1-6782-46ea-baff-2eabad97d967",
          bindingMessage: "binding-message",
          clientNotificationToken: "client-notification.jwt.jwt",
          expires: "2021-01-02T08:00:00.000Z",
          idTokenHint: "id.jwt.jwt",
          loginHint: "test@lindorm.io",
          loginHintToken: "login-hint.jwt.jwt",
          requestedExpiry: 3600,
          userCode: "user-code",
        },

        client: {
          id: "db5c195a-1c0b-41b2-b047-94c13a7dd30d",
          name: "ClientName",
          logoUri: "https://logo.uri/logo",
          singleSignOn: true,
          type: "confidential",
        },

        tenant: {
          id: "9e3d1333-efa1-4160-bbcc-ad8fe550f442",
          name: "TenantName",
        },
      },
    });
  });
});
