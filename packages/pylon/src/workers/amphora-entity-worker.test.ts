import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { LindormWorker } from "@lindorm/worker";
import { Kryptos } from "../entities/Kryptos.js";
import { createAmphoraEntityWorker } from "./amphora-entity-worker.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockRefresh, mockAdd, mockFind, mockRepository, mockFromDb } = vi.hoisted(() => ({
  mockRefresh: vi.fn().mockResolvedValue(undefined),
  mockAdd: vi.fn(),
  mockFind: vi.fn().mockResolvedValue([]),
  mockRepository: vi.fn().mockReturnValue({ find: undefined }),
  mockFromDb: vi.fn().mockImplementation((data: any) => ({ id: data.id })),
}));
mockRepository.mockReturnValue({ find: mockFind });

vi.mock("@lindorm/kryptos", async () => ({
  KryptosKit: { from: { db: mockFromDb } },
}));

describe("createAmphoraEntityWorker", () => {
  const amphora: any = { refresh: mockRefresh, add: mockAdd };
  const proteus: any = { repository: mockRepository };
  const logger = createMockLogger();

  class FakeKryptosDB {}

  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockResolvedValue([]);
  });

  test("should return a LindormWorker instance with correct alias", () => {
    const worker = createAmphoraEntityWorker({ amphora, logger, proteus });

    expect(worker).toBeInstanceOf(LindormWorker);
    expect(worker.alias).toBe("AmphoraEntityWorker");
  });

  test("should accept interval, listeners, jitter and retry overrides", () => {
    expect(() =>
      createAmphoraEntityWorker({
        amphora,
        logger,
        proteus,
        interval: "10m",
        listeners: [{ event: "start", listener: () => {} }],
        jitter: "1s",
        retry: { maxAttempts: 3 },
      }),
    ).not.toThrow();
  });

  describe("callback", () => {
    test("should default repository target to Kryptos entity when target not provided", async () => {
      const worker = createAmphoraEntityWorker({ amphora, logger, proteus });

      await worker.trigger();

      expect(mockRepository).toHaveBeenCalledWith(Kryptos);
    });

    test("should use provided target override when supplied", async () => {
      const worker = createAmphoraEntityWorker({
        amphora,
        logger,
        proteus,
        target: FakeKryptosDB as any,
      });

      await worker.trigger();

      expect(mockRepository).toHaveBeenCalledWith(FakeKryptosDB);
    });

    test("should load keys from repository and add to amphora", async () => {
      const worker = createAmphoraEntityWorker({ amphora, logger, proteus });

      await worker.trigger();

      expect(mockFind).toHaveBeenCalledTimes(1);
      expect(mockAdd).toHaveBeenCalledWith([]);
    });

    test("should not refresh amphora (handled by internal AmphoraWorker)", async () => {
      const worker = createAmphoraEntityWorker({ amphora, logger, proteus });

      await worker.trigger();

      expect(mockRefresh).not.toHaveBeenCalled();
    });

    test("should convert found entities to kryptos and add them", async () => {
      const entity = { id: "key-1", algorithm: "ES512", privateKey: null };
      mockFind.mockResolvedValueOnce([entity]);

      const worker = createAmphoraEntityWorker({ amphora, logger, proteus });

      await worker.trigger();

      expect(mockFromDb).toHaveBeenCalledWith(entity);
      expect(mockAdd).toHaveBeenCalledWith([{ id: "key-1" }]);
    });

    test("should handle multiple entities", async () => {
      const entities = [
        { id: "key-1", privateKey: null },
        { id: "key-2", privateKey: null },
        { id: "key-3", privateKey: null },
      ];
      mockFind.mockResolvedValueOnce(entities);

      const worker = createAmphoraEntityWorker({ amphora, logger, proteus });

      await worker.trigger();

      expect(mockFromDb).toHaveBeenCalledTimes(3);
      expect(mockAdd).toHaveBeenCalledWith([
        { id: "key-1" },
        { id: "key-2" },
        { id: "key-3" },
      ]);
    });
  });
});
