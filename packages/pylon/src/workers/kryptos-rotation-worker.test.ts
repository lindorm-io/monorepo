const mockEncrypt = jest.fn().mockImplementation((v: any) => "encrypted_" + v);
const mockGenerate = jest.fn().mockReturnValue({
  toDB: () => ({
    id: "new-key-id",
    algorithm: "ES512",
    privateKey: "generated-private-key",
  }),
});
const mockFind = jest.fn().mockResolvedValue([]);
const mockCreate = jest.fn().mockImplementation((data: any) => data);
const mockInsert = jest.fn().mockImplementation((entity: any) => ({
  ...entity,
  expiresAt: new Date("2026-10-01T00:00:00.000Z"),
}));
const mockRepository = jest.fn().mockReturnValue({
  find: mockFind,
  create: mockCreate,
  insert: mockInsert,
});
import { createMockLogger } from "@lindorm/logger";
const mockLogger = createMockLogger();

jest.mock("@lindorm/aes", () => ({
  AesKit: class AesKit {
    encrypt = mockEncrypt;
  },
}));

jest.mock("@lindorm/kryptos", () => ({
  KryptosKit: { generate: { auto: mockGenerate } },
}));

import { createKryptosRotationWorker } from "./kryptos-rotation-worker";

describe("createKryptosRotationWorker", () => {
  const proteus: any = { repository: mockRepository };

  class FakeKryptosDB {}

  beforeEach(() => {
    jest.clearAllMocks();
    mockFind.mockResolvedValue([]);
    mockGenerate.mockReturnValue({
      toDB: () => ({
        id: "new-key-id",
        algorithm: "ES512",
        privateKey: "generated-private-key",
      }),
    });
    mockInsert.mockImplementation((entity: any) => ({
      ...entity,
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    }));
  });

  test("should return a worker config with correct alias", () => {
    const config = createKryptosRotationWorker({
      proteus,
      target: FakeKryptosDB as any,
    });

    expect(config.alias).toBe("KryptosRotationWorker");
  });

  test("should default interval to 1d", () => {
    const config = createKryptosRotationWorker({
      proteus,
      target: FakeKryptosDB as any,
    });

    expect(config.interval).toBe("1d");
  });

  test("should default listeners to empty array", () => {
    const config = createKryptosRotationWorker({
      proteus,
      target: FakeKryptosDB as any,
    });

    expect(config.listeners).toEqual([]);
  });

  test("should use provided interval", () => {
    const config = createKryptosRotationWorker({
      proteus,
      target: FakeKryptosDB as any,
      interval: "12h",
    });

    expect(config.interval).toBe("12h");
  });

  describe("callback", () => {
    test("should use default keys when none provided", async () => {
      const config = createKryptosRotationWorker({
        proteus,
        target: FakeKryptosDB as any,
      });

      await config.callback({ logger: mockLogger } as any);

      // Default keys: 6 key types (dir, HS256, EdDSA, ECDH-ES, ES512, ECDH-ES+A128GCMKW)
      // Each with 0 existing keys generates 2 keys (one initial + one rotation)
      expect(mockGenerate).toHaveBeenCalledTimes(12);
    });

    test("should use provided keys", async () => {
      const keys = [{ algorithm: "ES256", purpose: "test" }];

      const config = createKryptosRotationWorker({
        proteus,
        target: FakeKryptosDB as any,
        keys: keys as any,
      });

      await config.callback({ logger: mockLogger } as any);

      // 1 key type with 0 existing = 2 generates (initial + rotation)
      expect(mockGenerate).toHaveBeenCalledTimes(2);
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ algorithm: "ES256", purpose: "test" }),
      );
    });

    test("should create initial key when no existing keys found", async () => {
      mockFind.mockResolvedValueOnce([]);

      const config = createKryptosRotationWorker({
        proteus,
        target: FakeKryptosDB as any,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await config.callback({ logger: mockLogger } as any);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "No existing keys found, generating initial key",
        {
          algorithm: "ES512",
          purpose: "token",
        },
      );
      expect(mockCreate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    test("should create rotation key when only one existing key found", async () => {
      const existingKey = {
        algorithm: "ES512",
        purpose: "token",
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      };
      mockFind.mockResolvedValueOnce([existingKey]);

      const config = createKryptosRotationWorker({
        proteus,
        target: FakeKryptosDB as any,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await config.callback({ logger: mockLogger } as any);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Only one key found, generating rotation key",
        {
          algorithm: "ES512",
          purpose: "token",
        },
      );
    });

    test("should not create keys when two or more existing keys found", async () => {
      const existingKeys = [
        { algorithm: "ES512", purpose: "token", expiresAt: new Date() },
        { algorithm: "ES512", purpose: "token", expiresAt: new Date() },
      ];
      mockFind.mockResolvedValueOnce(existingKeys);

      const config = createKryptosRotationWorker({
        proteus,
        target: FakeKryptosDB as any,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await config.callback({ logger: mockLogger } as any);

      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    test("should encrypt private key when encryption key is provided", async () => {
      mockFind.mockResolvedValueOnce([]);

      const config = createKryptosRotationWorker({
        proteus,
        target: FakeKryptosDB as any,
        encryptionKey: {} as any,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await config.callback({ logger: mockLogger } as any);

      expect(mockEncrypt).toHaveBeenCalledWith("generated-private-key", "tokenised");
    });

    test("should not encrypt when no encryption key is provided", async () => {
      mockFind.mockResolvedValueOnce([]);

      const config = createKryptosRotationWorker({
        proteus,
        target: FakeKryptosDB as any,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await config.callback({ logger: mockLogger } as any);

      expect(mockEncrypt).not.toHaveBeenCalled();
    });

    test("should not encrypt when generated key has no private key", async () => {
      mockFind.mockResolvedValueOnce([]);
      mockGenerate.mockReturnValue({
        toDB: () => ({
          id: "new-key-id",
          algorithm: "ES512",
          privateKey: null,
        }),
      });

      const config = createKryptosRotationWorker({
        proteus,
        target: FakeKryptosDB as any,
        encryptionKey: {} as any,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await config.callback({ logger: mockLogger } as any);

      expect(mockEncrypt).not.toHaveBeenCalled();
    });

    test("should filter existing keys by algorithm and purpose", async () => {
      const existingKeys = [
        { algorithm: "ES512", purpose: "token", expiresAt: new Date() },
        { algorithm: "ES512", purpose: "token", expiresAt: new Date() },
        { algorithm: "HS256", purpose: "cookie", expiresAt: new Date() },
      ];
      mockFind.mockResolvedValueOnce(existingKeys);

      const config = createKryptosRotationWorker({
        proteus,
        target: FakeKryptosDB as any,
        keys: [
          { algorithm: "ES512", purpose: "token" },
          { algorithm: "HS256", purpose: "cookie" },
        ],
      });

      await config.callback({ logger: mockLogger } as any);

      // ES512/token has 2 existing keys: no generation
      // HS256/cookie has 1 existing key: generates rotation key
      expect(mockGenerate).toHaveBeenCalledTimes(1);
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ algorithm: "HS256", purpose: "cookie" }),
      );
    });

    test("should use default expiry of 6m", async () => {
      mockFind.mockResolvedValueOnce([]);

      const config = createKryptosRotationWorker({
        proteus,
        target: FakeKryptosDB as any,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await config.callback({ logger: mockLogger } as any);

      // The initial key generation call should have an expiresAt roughly 6 months out
      const call = mockGenerate.mock.calls[0][0];
      expect(call.algorithm).toBe("ES512");
      expect(call.purpose).toBe("token");
      expect(call.notBefore).toBeInstanceOf(Date);
      expect(call.expiresAt).toBeInstanceOf(Date);
    });
  });
});
