import { RdcSessionMode, SessionStatus } from "@lindorm-io/common-types";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import { createTestRdcSession } from "../../fixtures/entity";
import { getPendingRdcSessionsController } from "./get-pending";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getPendingRdcSessionsController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        rdcSessionCache: createMockRedisRepository(createTestRdcSession),
      },
      data: {
        id: "ac0257af-9f8a-4731-bda1-dd7416e945bf",
      },
      token: {
        bearerToken: {
          subject: "ac0257af-9f8a-4731-bda1-dd7416e945bf",
        },
      },
    };
  });

  test("should resolve with pending sessions", async () => {
    ctx.redis.rdcSessionCache.findMany.mockResolvedValue([
      createTestRdcSession({
        id: "1dcea497-ced2-419b-83d4-eeb388f5ba9d",
        expires: new Date("2021-01-01T08:15:00.000Z"),
        mode: RdcSessionMode.PUSH_NOTIFICATION,
        status: SessionStatus.ACKNOWLEDGED,
      }),
      createTestRdcSession({
        id: "9dd0d035-e5ee-4fae-8afe-8d1453544750",
        expires: new Date("2021-01-01T08:20:00.000Z"),
        mode: RdcSessionMode.PUSH_NOTIFICATION,
        status: SessionStatus.PENDING,
      }),
      createTestRdcSession({
        id: "a92d3934-5b22-49c2-9311-779f4cc43aa9",
        expires: new Date("2021-01-01T08:25:00.000Z"),
        mode: RdcSessionMode.QR_CODE,
        status: SessionStatus.PENDING,
      }),
      createTestRdcSession({
        id: "64dcb3e9-c448-451c-87c8-b7417d04d2f9",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        mode: RdcSessionMode.PUSH_NOTIFICATION,
        status: SessionStatus.REJECTED,
      }),
    ]);

    await expect(getPendingRdcSessionsController(ctx)).resolves.toStrictEqual({
      body: {
        sessions: [
          {
            id: "9dd0d035-e5ee-4fae-8afe-8d1453544750",
            expires: "2021-01-01T08:20:00.000Z",
          },
        ],
      },
    });
  });
});
