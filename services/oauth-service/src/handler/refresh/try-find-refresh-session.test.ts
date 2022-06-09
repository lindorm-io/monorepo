import { RefreshSession } from "../../entity";
import { Scope } from "../../common";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestRefreshSession } from "../../fixtures/entity";
import { tryFindRefreshSession } from "./try-find-refresh-session";

describe("tryFindRefreshSession", () => {
  let ctx: any;
  let idToken: any;

  beforeEach(() => {
    ctx = {
      repository: {
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };

    idToken = {
      scopes: [Scope.OFFLINE_ACCESS],
      sessionId: "bc9ebf6f-2c5b-47ba-875b-810f56122f75",
    };
  });

  test("should resolve refresh session", async () => {
    await expect(tryFindRefreshSession(ctx, idToken)).resolves.toStrictEqual(
      expect.any(RefreshSession),
    );

    expect(ctx.repository.refreshSessionRepository.find).toHaveBeenCalled();
  });

  test("should throw on unexpected error", async () => {
    ctx.repository.refreshSessionRepository.find.mockRejectedValue(new Error("test"));

    await expect(tryFindRefreshSession(ctx, idToken)).rejects.toThrow(Error);
  });
});
