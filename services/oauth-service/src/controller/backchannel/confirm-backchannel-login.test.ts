import { SessionStatus } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { createTestBackchannelSession } from "../../fixtures/entity";
import { resolveBackchannelAuthentication as _resolveBackchannelAuthentication } from "../../handler";
import { confirmBackchannelLoginController } from "./confirm-backchannel-login";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const resolveBackchannelAuthentication = _resolveBackchannelAuthentication as jest.Mock;

describe("confirmBackchannelLoginController", () => {
  let ctx: any;
  let backchannelSession = createTestBackchannelSession();

  beforeEach(() => {
    ctx = {
      redis: {
        backchannelSessionCache: createMockRedisRepository(createTestBackchannelSession),
      },
      data: {
        identityId: "5902daa2-2d3b-40e7-ab97-3dcebe190b98",
        levelOfAssurance: 3,
        metadata: { ip: "127.0.0.1" },
        methods: ["phone"],
        remember: true,
        singleSignOn: true,
      },
      entity: {
        backchannelSession,
      },
      logger: createMockLogger(),
    };

    resolveBackchannelAuthentication.mockResolvedValue(undefined);
  });

  test("should resolve", async () => {
    await expect(confirmBackchannelLoginController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.backchannelSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedLogin: {
          identityId: "5902daa2-2d3b-40e7-ab97-3dcebe190b98",
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 3,
          metadata: { ip: "127.0.0.1" },
          methods: ["phone"],
          remember: true,
          singleSignOn: true,
        },
        status: expect.objectContaining({ login: "confirmed" }),
      }),
    );

    expect(resolveBackchannelAuthentication).toHaveBeenCalled;
  });

  test("should throw on invalid status", async () => {
    ctx.entity.backchannelSession = createTestBackchannelSession({
      status: {
        login: SessionStatus.REJECTED,
        consent: SessionStatus.REJECTED,
      },
    });

    await expect(confirmBackchannelLoginController(ctx)).rejects.toThrow(ClientError);
  });
});
