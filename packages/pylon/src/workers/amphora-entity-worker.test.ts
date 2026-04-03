const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockAdd = jest.fn();
const mockFind = jest.fn().mockResolvedValue([]);
const mockRepository = jest.fn().mockReturnValue({ find: mockFind });
const mockDecrypt = jest.fn().mockImplementation((v: any) => "decrypted_" + v);
const mockIsAesTokenised = jest.fn().mockReturnValue(false);
const mockFromDb = jest.fn().mockImplementation((data: any) => ({ id: data.id }));

jest.mock("@lindorm/aes", () => ({
  AesKit: class AesKit {
    decrypt = mockDecrypt;
    static isAesTokenised = mockIsAesTokenised;
  },
}));

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
    mockIsAesTokenised.mockReturnValue(false);
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

    test("should decrypt private keys when encryption key is provided and key is tokenised", async () => {
      const entity = { id: "key-1", privateKey: "encrypted-data" };
      mockFind.mockResolvedValueOnce([entity]);
      mockIsAesTokenised.mockReturnValue(true);

      const config = createAmphoraEntityWorker({
        amphora,
        proteus,
        target: FakeKryptosDB as any,
        encryptionKey: {} as any,
      });

      await config.callback(ctx);

      expect(mockDecrypt).toHaveBeenCalledWith("encrypted-data");
      expect(entity.privateKey).toBe("decrypted_encrypted-data");
    });

    test("should not decrypt when private key is not tokenised", async () => {
      const entity = { id: "key-1", privateKey: "plain-data" };
      mockFind.mockResolvedValueOnce([entity]);
      mockIsAesTokenised.mockReturnValue(false);

      const config = createAmphoraEntityWorker({
        amphora,
        proteus,
        target: FakeKryptosDB as any,
        encryptionKey: {} as any,
      });

      await config.callback(ctx);

      expect(mockDecrypt).not.toHaveBeenCalled();
      expect(entity.privateKey).toBe("plain-data");
    });

    test("should not decrypt when no encryption key is provided", async () => {
      const entity = { id: "key-1", privateKey: "data" };
      mockFind.mockResolvedValueOnce([entity]);
      mockIsAesTokenised.mockReturnValue(true);

      const config = createAmphoraEntityWorker({
        amphora,
        proteus,
        target: FakeKryptosDB as any,
      });

      await config.callback(ctx);

      expect(mockDecrypt).not.toHaveBeenCalled();
    });

    test("should skip decryption when entity has no private key", async () => {
      const entity = { id: "key-1", privateKey: null };
      mockFind.mockResolvedValueOnce([entity]);

      const config = createAmphoraEntityWorker({
        amphora,
        proteus,
        target: FakeKryptosDB as any,
        encryptionKey: {} as any,
      });

      await config.callback(ctx);

      expect(mockDecrypt).not.toHaveBeenCalled();
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
