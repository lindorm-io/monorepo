import MockDate from "mockdate";
import { confirmLogoutController } from "./confirm-logout";
import { createLogoutVerifyUri as _createLogoutVerifyRedirectUri } from "../../util";
import { createMockCache } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestLogoutSession } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const createLogoutVerifyRedirectUri = _createLogoutVerifyRedirectUri as jest.Mock;

describe("confirmLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: createMockCache(createTestLogoutSession),
      },
      data: {
        accessSessionId: "23de470a-b05a-4408-89cf-a7153de5a00b",
        browserSessionId: "1efe4d7c-4de7-4647-9e8f-d4254055e02d",
        refreshSessionId: "96759ddf-0e58-40ef-b8d5-17d3a7495fbf",
      },
      entity: {
        logoutSession: createTestLogoutSession(),
      },
      logger: createMockLogger(),
    };

    createLogoutVerifyRedirectUri.mockImplementation(() => "createLogoutVerifyRedirectUri");
  });

  test("should resolve", async () => {
    await expect(confirmLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLogoutVerifyRedirectUri" },
    });

    expect(ctx.cache.logoutSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "confirmed",
      }),
    );
  });
});
