const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockAdd = jest.fn();
const mockFind = jest.fn().mockResolvedValue([]);
const mockRepository = jest.fn().mockReturnValue({ find: mockFind });
const mockFromDb = jest.fn().mockImplementation((data: any) => ({ id: data.id }));

jest.mock("@lindorm/kryptos", () => ({
  KryptosKit: { from: { db: mockFromDb } },
}));

import { createMockLogger } from "@lindorm/logger";
import { LindormWorker } from "@lindorm/worker";
import { Kryptos } from "../entities/Kryptos";
import { createAmphoraEntityWorker } from "./amphora-entity-worker";

describe("createAmphoraEntityWorker", () => {
  const amphora: any = { refresh: mockRefresh, add: mockAdd };
  const proteus: any = { repository: mockRepository };
  const logger = createMockLogger();

  class FakeKryptosDB {}

  beforeEach(() => {
    jest.clearAllMocks();
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

    test("should refresh amphora and add keys", async () => {
      const worker = createAmphoraEntityWorker({ amphora, logger, proteus });

      await worker.trigger();

      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(mockFind).toHaveBeenCalledTimes(1);
      expect(mockAdd).toHaveBeenCalledWith([]);
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
