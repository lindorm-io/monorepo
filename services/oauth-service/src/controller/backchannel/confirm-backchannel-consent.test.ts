import { Scope, SessionStatus } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { createTestBackchannelSession, createTestClient } from "../../fixtures/entity";
import { resolveBackchannelAuthentication as _resolveBackchannelAuthentication } from "../../handler";
import { confirmBackchannelConsentController } from "./confirm-backchannel-consent";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const resolveBackchannelAuthentication = _resolveBackchannelAuthentication as jest.Mock;

describe("confirmBackchannelConsentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        backchannelSessionCache: createMockRedisRepository(createTestBackchannelSession),
      },
      data: {
        audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
        scopes: [
          Scope.ADDRESS,
          Scope.EMAIL,
          Scope.OFFLINE_ACCESS,
          Scope.OPENID,
          Scope.PHONE,
          Scope.PROFILE,
        ],
      },
      entity: {
        backchannelSession: createTestBackchannelSession({
          requestedConsent: {
            audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
            scopes: [
              Scope.ADDRESS,
              Scope.EMAIL,
              Scope.OFFLINE_ACCESS,
              Scope.OPENID,
              Scope.PHONE,
              Scope.PROFILE,
            ],
          },
        }),
        client: createTestClient(),
      },
      logger: createMockLogger(),
    };

    resolveBackchannelAuthentication.mockResolvedValue(undefined);
  });

  test("should resolve", async () => {
    await expect(confirmBackchannelConsentController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.backchannelSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedConsent: {
          audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
          scopes: [
            Scope.ADDRESS,
            Scope.EMAIL,
            Scope.OFFLINE_ACCESS,
            Scope.OPENID,
            Scope.PHONE,
            Scope.PROFILE,
          ],
        },
        status: expect.objectContaining({ consent: "confirmed" }),
      }),
    );

    expect(resolveBackchannelAuthentication).toHaveBeenCalled();
  });

  test("should throw on invalid status", async () => {
    ctx.entity.backchannelSession = createTestBackchannelSession({
      status: {
        login: SessionStatus.REJECTED,
        consent: SessionStatus.REJECTED,
      },
    });

    await expect(confirmBackchannelConsentController(ctx)).rejects.toThrow(ClientError);
  });
});
