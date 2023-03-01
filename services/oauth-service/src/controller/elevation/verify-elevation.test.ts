import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { createMockCache } from "@lindorm-io/redis";
import { createTestElevationSession } from "../../fixtures/entity";
import { randomUUID } from "crypto";
import { verifyElevationController } from "./verify-elevation";
import {
  updateAccessSessionElevation as _updateAccessSessionElevation,
  updateBrowserSessionElevation as _updateBrowserSessionElevation,
  updateRefreshSessionElevation as _updateRefreshSessionElevation,
} from "../../handler";
import { SessionStatus } from "@lindorm-io/common-types";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const updateAccessSessionElevation = _updateAccessSessionElevation as jest.Mock;
const updateBrowserSessionElevation = _updateBrowserSessionElevation as jest.Mock;
const updateRefreshSessionElevation = _updateRefreshSessionElevation as jest.Mock;

describe("verifyElevationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        elevationSessionCache: createMockCache(createTestElevationSession),
      },
      data: {},
      entity: {
        elevationSession: createTestElevationSession({
          accessSessionId: null,
          browserSessionId: null,
          refreshSessionId: null,
          status: SessionStatus.CONFIRMED,
        }),
      },
    };

    updateAccessSessionElevation.mockResolvedValue(undefined);
    updateBrowserSessionElevation.mockResolvedValue(undefined);
    updateRefreshSessionElevation.mockResolvedValue(undefined);
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

  test("should resolve for access session", async () => {
    ctx.entity.elevationSession = createTestElevationSession({
      accessSessionId: randomUUID(),
      browserSessionId: null,
      refreshSessionId: null,
      status: SessionStatus.CONFIRMED,
    });

    await expect(verifyElevationController(ctx)).resolves.toBeTruthy();

    expect(updateAccessSessionElevation).toHaveBeenCalled();
  });

  test("should resolve for browser session", async () => {
    ctx.entity.elevationSession = createTestElevationSession({
      accessSessionId: null,
      browserSessionId: randomUUID(),
      refreshSessionId: null,
      status: SessionStatus.CONFIRMED,
    });

    await expect(verifyElevationController(ctx)).resolves.toBeTruthy();

    expect(updateBrowserSessionElevation).toHaveBeenCalled();
  });

  test("should resolve for refresh session", async () => {
    ctx.entity.elevationSession = createTestElevationSession({
      accessSessionId: null,
      browserSessionId: null,
      refreshSessionId: randomUUID(),
      status: SessionStatus.CONFIRMED,
    });

    await expect(verifyElevationController(ctx)).resolves.toBeTruthy();

    expect(updateRefreshSessionElevation).toHaveBeenCalled();
  });

  test("should reject on invalid status", async () => {
    ctx.entity.elevationSession.status = "rejected";

    await expect(verifyElevationController(ctx)).rejects.toThrow(ClientError);
  });
});
