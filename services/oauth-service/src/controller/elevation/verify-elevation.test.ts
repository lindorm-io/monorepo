import { SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { createTestElevationSession } from "../../fixtures/entity";
import {
  updateBrowserSessionElevation as _updateBrowserSessionElevation,
  updateClientSessionElevation as _updateClientSessionElevation,
} from "../../handler";
import { verifyElevationController } from "./verify-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const updateBrowserSessionElevation = _updateBrowserSessionElevation as jest.Mock;
const updateClientSessionElevation = _updateClientSessionElevation as jest.Mock;

describe("verifyElevationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        elevationSessionCache: createMockRedisRepository(createTestElevationSession),
      },
      data: {},
      entity: {
        elevationSession: createTestElevationSession({
          browserSessionId: null,
          clientSessionId: null,
          status: SessionStatus.CONFIRMED,
        }),
      },
    };

    updateBrowserSessionElevation.mockResolvedValue(undefined);
    updateClientSessionElevation.mockResolvedValue(undefined);
  });

  afterEach(jest.clearAllMocks);

  test("should resolve", async () => {
    await expect(verifyElevationController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });
  });

  test("should resolve without redirect", async () => {
    ctx.entity.elevationSession = createTestElevationSession({
      redirectUri: null,
      status: SessionStatus.CONFIRMED,
    });

    await expect(verifyElevationController(ctx)).resolves.toBeUndefined();
  });

  test("should resolve for browser session", async () => {
    ctx.entity.elevationSession = createTestElevationSession({
      browserSessionId: randomUUID(),
      clientSessionId: null,
      status: SessionStatus.CONFIRMED,
    });

    await expect(verifyElevationController(ctx)).resolves.toBeTruthy();

    expect(updateBrowserSessionElevation).toHaveBeenCalled();
  });

  test("should resolve for client session", async () => {
    ctx.entity.elevationSession = createTestElevationSession({
      browserSessionId: null,
      clientSessionId: randomUUID(),
      status: SessionStatus.CONFIRMED,
    });

    await expect(verifyElevationController(ctx)).resolves.toBeTruthy();

    expect(updateClientSessionElevation).toHaveBeenCalled();
  });

  test("should reject on invalid status", async () => {
    ctx.entity.elevationSession.status = "rejected";

    await expect(verifyElevationController(ctx)).rejects.toThrow(ClientError);
  });
});
