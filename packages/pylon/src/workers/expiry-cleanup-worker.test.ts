import { createMockLogger } from "@lindorm/logger";
import { LindormWorker } from "@lindorm/worker";
import { createExpiryCleanupWorker } from "./expiry-cleanup-worker";

describe("createExpiryCleanupWorker", () => {
  const mockDeleteExpired = jest.fn().mockResolvedValue(undefined);
  const mockRepository = jest.fn().mockReturnValue({ deleteExpired: mockDeleteExpired });
  const proteus: any = { repository: mockRepository };
  const logger = createMockLogger();

  class EntityA {}
  class EntityB {}

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return a LindormWorker instance with correct alias", () => {
    const worker = createExpiryCleanupWorker({ logger, proteus, targets: [] });

    expect(worker).toBeInstanceOf(LindormWorker);
    expect(worker.alias).toBe("ExpiryCleanupWorker");
  });

  test("should accept interval and listeners overrides", () => {
    expect(() =>
      createExpiryCleanupWorker({
        logger,
        proteus,
        targets: [],
        interval: "30m",
        listeners: [{ event: "start", listener: () => {} }],
      }),
    ).not.toThrow();
  });

  describe("callback", () => {
    test("should delete expired entities for each target", async () => {
      const worker = createExpiryCleanupWorker({
        logger,
        proteus,
        targets: [EntityA as any, EntityB as any],
      });

      await worker.trigger();

      expect(mockRepository).toHaveBeenCalledTimes(2);
      expect(mockRepository).toHaveBeenCalledWith(EntityA);
      expect(mockRepository).toHaveBeenCalledWith(EntityB);
      expect(mockDeleteExpired).toHaveBeenCalledTimes(2);
    });

    test("should handle empty targets array", async () => {
      const worker = createExpiryCleanupWorker({ logger, proteus, targets: [] });

      await worker.trigger();

      expect(mockRepository).not.toHaveBeenCalled();
      expect(mockDeleteExpired).not.toHaveBeenCalled();
    });

    test("should handle single target", async () => {
      const worker = createExpiryCleanupWorker({
        logger,
        proteus,
        targets: [EntityA as any],
      });

      await worker.trigger();

      expect(mockRepository).toHaveBeenCalledTimes(1);
      expect(mockRepository).toHaveBeenCalledWith(EntityA);
      expect(mockDeleteExpired).toHaveBeenCalledTimes(1);
    });

    test("should continue processing remaining targets when one fails", async () => {
      const failingDelete = jest.fn().mockRejectedValue(new Error("DB error"));
      const succeedingDelete = jest.fn().mockResolvedValue(undefined);

      const failProteus: any = {
        repository: jest
          .fn()
          .mockImplementation((target: any) =>
            target === EntityA
              ? { deleteExpired: failingDelete }
              : { deleteExpired: succeedingDelete },
          ),
      };

      const worker = createExpiryCleanupWorker({
        logger,
        proteus: failProteus,
        targets: [EntityA as any, EntityB as any],
      });

      await worker.trigger();

      expect(failingDelete).toHaveBeenCalledTimes(1);
      expect(succeedingDelete).toHaveBeenCalledTimes(1);
    });
  });
});
