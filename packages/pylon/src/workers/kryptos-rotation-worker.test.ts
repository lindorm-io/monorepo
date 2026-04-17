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

jest.mock("@lindorm/kryptos", () => ({
  KryptosKit: { generate: { auto: mockGenerate } },
}));

import { LindormWorker } from "@lindorm/worker";
import { Kryptos } from "../entities/Kryptos";
import { createKryptosRotationWorker } from "./kryptos-rotation-worker";

describe("createKryptosRotationWorker", () => {
  const proteus: any = { repository: mockRepository };

  class FakeKryptosDB {}

  beforeEach(() => {
    jest.clearAllMocks();
    (mockLogger.child as jest.Mock).mockImplementation(() => mockLogger);
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

  test("should return a LindormWorker instance with correct alias", () => {
    const worker = createKryptosRotationWorker({ logger: mockLogger, proteus });

    expect(worker).toBeInstanceOf(LindormWorker);
    expect(worker.alias).toBe("KryptosRotationWorker");
  });

  test("should accept interval override without throwing", () => {
    expect(() =>
      createKryptosRotationWorker({ logger: mockLogger, proteus, interval: "12h" }),
    ).not.toThrow();
  });

  describe("callback", () => {
    test("should default repository target to Kryptos entity when target not provided", async () => {
      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockRepository).toHaveBeenCalledWith(Kryptos);
    });

    test("should use provided target override when supplied", async () => {
      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        target: FakeKryptosDB as any,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockRepository).toHaveBeenCalledWith(FakeKryptosDB);
    });

    test("should use default keys when none provided", async () => {
      const worker = createKryptosRotationWorker({ logger: mockLogger, proteus });

      await worker.trigger();

      expect(mockGenerate).toHaveBeenCalledTimes(12);
    });

    test("should use provided keys", async () => {
      const keys = [{ algorithm: "ES256", purpose: "test" }];

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        keys: keys as any,
      });

      await worker.trigger();

      expect(mockGenerate).toHaveBeenCalledTimes(2);
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ algorithm: "ES256", purpose: "test" }),
      );
    });

    test("should create initial key when no existing keys found", async () => {
      mockFind.mockResolvedValueOnce([]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

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

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

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

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    test("should filter existing keys by algorithm and purpose", async () => {
      const existingKeys = [
        { algorithm: "ES512", purpose: "token", expiresAt: new Date() },
        { algorithm: "ES512", purpose: "token", expiresAt: new Date() },
        { algorithm: "HS256", purpose: "cookie", expiresAt: new Date() },
      ];
      mockFind.mockResolvedValueOnce(existingKeys);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        keys: [
          { algorithm: "ES512", purpose: "token" },
          { algorithm: "HS256", purpose: "cookie" },
        ],
      });

      await worker.trigger();

      expect(mockGenerate).toHaveBeenCalledTimes(1);
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ algorithm: "HS256", purpose: "cookie" }),
      );
    });

    test("should use default expiry of 6m", async () => {
      mockFind.mockResolvedValueOnce([]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      const call = mockGenerate.mock.calls[0][0];
      expect(call.algorithm).toBe("ES512");
      expect(call.purpose).toBe("token");
      expect(call.notBefore).toBeInstanceOf(Date);
      expect(call.expiresAt).toBeInstanceOf(Date);
    });
  });
});
