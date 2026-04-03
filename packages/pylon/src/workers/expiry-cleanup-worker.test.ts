import { createExpiryCleanupWorker } from "./expiry-cleanup-worker";

describe("createExpiryCleanupWorker", () => {
  const mockDeleteExpired = jest.fn().mockResolvedValue(undefined);
  const mockRepository = jest.fn().mockReturnValue({ deleteExpired: mockDeleteExpired });
  const proteus: any = { repository: mockRepository };

  class EntityA {}
  class EntityB {}

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return a worker config with correct alias", () => {
    const config = createExpiryCleanupWorker({
      proteus,
      targets: [],
    });

    expect(config.alias).toBe("ExpiryCleanupWorker");
  });

  test("should default interval to 15m", () => {
    const config = createExpiryCleanupWorker({
      proteus,
      targets: [],
    });

    expect(config.interval).toBe("15m");
  });

  test("should default listeners to empty array", () => {
    const config = createExpiryCleanupWorker({
      proteus,
      targets: [],
    });

    expect(config.listeners).toEqual([]);
  });

  test("should use provided interval", () => {
    const config = createExpiryCleanupWorker({
      proteus,
      targets: [],
      interval: "30m",
    });

    expect(config.interval).toBe("30m");
  });

  test("should use provided listeners", () => {
    const listeners: any = [{ event: "test" }];
    const config = createExpiryCleanupWorker({
      proteus,
      targets: [],
      listeners,
    });

    expect(config.listeners).toBe(listeners);
  });

  describe("callback", () => {
    test("should delete expired entities for each target", async () => {
      const config = createExpiryCleanupWorker({
        proteus,
        targets: [EntityA as any, EntityB as any],
      });

      await config.callback({} as any);

      expect(mockRepository).toHaveBeenCalledTimes(2);
      expect(mockRepository).toHaveBeenCalledWith(EntityA);
      expect(mockRepository).toHaveBeenCalledWith(EntityB);
      expect(mockDeleteExpired).toHaveBeenCalledTimes(2);
    });

    test("should handle empty targets array", async () => {
      const config = createExpiryCleanupWorker({
        proteus,
        targets: [],
      });

      await config.callback({} as any);

      expect(mockRepository).not.toHaveBeenCalled();
      expect(mockDeleteExpired).not.toHaveBeenCalled();
    });

    test("should handle single target", async () => {
      const config = createExpiryCleanupWorker({
        proteus,
        targets: [EntityA as any],
      });

      await config.callback({} as any);

      expect(mockRepository).toHaveBeenCalledTimes(1);
      expect(mockRepository).toHaveBeenCalledWith(EntityA);
      expect(mockDeleteExpired).toHaveBeenCalledTimes(1);
    });
  });
});
