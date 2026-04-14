const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockAdd = jest.fn();
const mockFind = jest.fn().mockResolvedValue([]);
const mockRepository = jest.fn().mockReturnValue({ find: mockFind });
const mockFromDb = jest.fn().mockImplementation((data: any) => ({ id: data.id }));

jest.mock("@lindorm/kryptos", () => ({
  KryptosKit: { from: { db: mockFromDb } },
}));

import { createMockLogger } from "@lindorm/logger";
import { createAmphoraEntityWorker } from "./amphora-entity-worker";

describe("createAmphoraEntityWorker", () => {
  const amphora: any = { refresh: mockRefresh, add: mockAdd };
  const proteus: any = { repository: mockRepository };
  const ctx: any = { logger: createMockLogger() };

  class FakeKryptosDB {}

  beforeEach(() => {
    jest.clearAllMocks();
    mockFind.mockResolvedValue([]);
  });

  test("should return a worker config with correct alias", () => {
    const config = createAmphoraEntityWorker({
      amphora,
      proteus,
      target: FakeKryptosDB as any,
    });

    expect(config.alias).toBe("AmphoraEntityWorker");
  });

  test("should default interval to 3m", () => {
    const config = createAmphoraEntityWorker({
      amphora,
      proteus,
      target: FakeKryptosDB as any,
    });

    expect(config.interval).toBe("3m");
  });

  test("should default listeners to empty array", () => {
    const config = createAmphoraEntityWorker({
      amphora,
      proteus,
      target: FakeKryptosDB as any,
    });

    expect(config.listeners).toEqual([]);
  });

  test("should use provided interval", () => {
    const config = createAmphoraEntityWorker({
      amphora,
      proteus,
      target: FakeKryptosDB as any,
      interval: "10m",
    });

    expect(config.interval).toBe("10m");
  });

  test("should use provided listeners", () => {
    const listeners: any = [{ event: "test" }];
    const config = createAmphoraEntityWorker({
      amphora,
      proteus,
      target: FakeKryptosDB as any,
      listeners,
    });

    expect(config.listeners).toBe(listeners);
  });

  test("should pass through jitter and retry", () => {
    const config = createAmphoraEntityWorker({
      amphora,
      proteus,
      target: FakeKryptosDB as any,
      jitter: "1s",
      retry: 3,
    } as any);

    expect(config.jitter).toBe("1s");
    expect(config.retry).toBe(3);
  });

  describe("callback", () => {
    test("should refresh amphora and add keys", async () => {
      const config = createAmphoraEntityWorker({
        amphora,
        proteus,
        target: FakeKryptosDB as any,
      });

      await config.callback(ctx);

      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(mockRepository).toHaveBeenCalledWith(FakeKryptosDB);
      expect(mockFind).toHaveBeenCalledTimes(1);
      expect(mockAdd).toHaveBeenCalledWith([]);
    });

    test("should convert found entities to kryptos and add them", async () => {
      const entity = { id: "key-1", algorithm: "ES512", privateKey: null };
      mockFind.mockResolvedValueOnce([entity]);

      const config = createAmphoraEntityWorker({
        amphora,
        proteus,
        target: FakeKryptosDB as any,
      });

      await config.callback(ctx);

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

      const config = createAmphoraEntityWorker({
        amphora,
        proteus,
        target: FakeKryptosDB as any,
      });

      await config.callback(ctx);

      expect(mockFromDb).toHaveBeenCalledTimes(3);
      expect(mockAdd).toHaveBeenCalledWith([
        { id: "key-1" },
        { id: "key-2" },
        { id: "key-3" },
      ]);
    });
  });
});
