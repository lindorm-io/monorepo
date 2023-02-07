import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { createMockCache } from "@lindorm-io/redis";
import { createTestElevationSession } from "../../../fixtures/entity";
import { randomString } from "@lindorm-io/random";
import { verifyElevationController } from "./verify-elevation";
import {
  verifyBrowserSessionElevation as _verifyBrowserSessionElevation,
  verifyRefreshSessionElevation as _verifyRefreshSessionElevation,
} from "../../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../../handler");

const verifyBrowserSessionElevation = _verifyBrowserSessionElevation as jest.Mock;
const verifyRefreshSessionElevation = _verifyRefreshSessionElevation as jest.Mock;

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
          status: "confirmed",
        }),
      },
    };

    verifyBrowserSessionElevation.mockResolvedValue(undefined);
    verifyRefreshSessionElevation.mockResolvedValue(undefined);
  });

  afterEach(jest.clearAllMocks);

  test("should resolve for browser session", async () => {
    ctx.entity.elevationSession.identifiers.refreshSessionId = null;

    await expect(verifyElevationController(ctx)).resolves.toBeUndefined();

    expect(verifyBrowserSessionElevation).toHaveBeenCalled();
  });

  test("should resolve for refresh session", async () => {
    ctx.entity.elevationSession.identifiers.browserSessionId = null;

    await expect(verifyElevationController(ctx)).resolves.toBeUndefined();

    expect(verifyRefreshSessionElevation).toHaveBeenCalled();
  });

  test("should resolve redirect uri", async () => {
    ctx.entity.elevationSession = createTestElevationSession({
      redirectUri: "https://test.uri/",
      state: randomString(16),
      status: "confirmed",
    });

    await expect(verifyElevationController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });
  });

  test("should reject on invalid status", async () => {
    ctx.entity.elevationSession.status = "rejected";

    await expect(verifyElevationController(ctx)).rejects.toThrow(ClientError);
  });
});
