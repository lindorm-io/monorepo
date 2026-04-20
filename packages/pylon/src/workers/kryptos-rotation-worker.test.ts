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
const octAlgorithms = new Set([
  "dir",
  "HS256",
  "HS384",
  "HS512",
  "A128KW",
  "A192KW",
  "A256KW",
  "A128GCMKW",
  "A192GCMKW",
  "A256GCMKW",
]);
const mockGetTypeForAlgorithm = jest.fn((algorithm: string) =>
  octAlgorithms.has(algorithm) ? "oct" : "EC",
);
import { createMockLogger } from "@lindorm/logger/mocks/jest";
const mockLogger = createMockLogger();

jest.mock("@lindorm/kryptos", () => ({
  KryptosKit: {
    generate: { auto: mockGenerate },
    getTypeForAlgorithm: mockGetTypeForAlgorithm,
  },
}));

import { LindormWorker } from "@lindorm/worker";
import { Kryptos } from "../entities/Kryptos";
import { createKryptosRotationWorker } from "./kryptos-rotation-worker";

const future = new Date("2030-01-01T00:00:00.000Z");

const seedInternalKeys = () => [
  { algorithm: "dir", purpose: "cookie", expiresAt: future },
  { algorithm: "dir", purpose: "cookie", expiresAt: future },
  { algorithm: "HS256", purpose: "cookie", expiresAt: future },
  { algorithm: "HS256", purpose: "cookie", expiresAt: future },
  { algorithm: "EdDSA", curve: "Ed448", purpose: "session", expiresAt: future },
  { algorithm: "EdDSA", curve: "Ed448", purpose: "session", expiresAt: future },
  { algorithm: "ECDH-ES", curve: "X448", purpose: "session", expiresAt: future },
  { algorithm: "ECDH-ES", curve: "X448", purpose: "session", expiresAt: future },
];

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
      mockFind.mockResolvedValueOnce(seedInternalKeys());
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
      mockFind.mockResolvedValueOnce([
        ...seedInternalKeys(),
        { algorithm: "ES512", purpose: "token", expiresAt: future },
        { algorithm: "ES512", purpose: "token", expiresAt: future },
      ]);

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
      mockFind.mockResolvedValueOnce([
        ...seedInternalKeys(),
        { algorithm: "ES512", purpose: "token", expiresAt: future },
        { algorithm: "ES512", purpose: "token", expiresAt: future },
      ]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        keys: [
          { algorithm: "ES512", purpose: "token" },
          { algorithm: "HS256", purpose: "mytoken" },
        ],
      });

      await worker.trigger();

      expect(mockGenerate).toHaveBeenCalledTimes(2);
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ algorithm: "HS256", purpose: "mytoken" }),
      );
      expect(mockGenerate).not.toHaveBeenCalledWith(
        expect.objectContaining({ algorithm: "ES512", purpose: "token" }),
      );
    });

    test("should treat expired keys as non-existent and generate initial key", async () => {
      const past = new Date("2020-01-01T00:00:00.000Z");
      mockFind.mockResolvedValueOnce([
        ...seedInternalKeys(),
        { algorithm: "ES512", purpose: "token", expiresAt: past },
      ]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "No existing keys found, generating initial key",
        expect.objectContaining({ algorithm: "ES512", purpose: "token" }),
      );
    });

    test("should count only non-expired keys toward rotation decision", async () => {
      const past = new Date("2020-01-01T00:00:00.000Z");
      mockFind.mockResolvedValueOnce([
        ...seedInternalKeys(),
        { algorithm: "ES512", purpose: "token", expiresAt: past },
        { algorithm: "ES512", purpose: "token", expiresAt: future },
      ]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        proteus,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Only one key found, generating rotation key",
        expect.objectContaining({ algorithm: "ES512", purpose: "token" }),
      );
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    test("should use default expiry of 6m", async () => {
      mockFind.mockResolvedValueOnce(seedInternalKeys());

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

    describe("rootCaKey", () => {
      const rootCaKey = { id: "root-ca-id" } as any;

      test("should not pass certificate when rootCaKey is unset", async () => {
        mockFind.mockResolvedValueOnce(seedInternalKeys());

        const worker = createKryptosRotationWorker({
          logger: mockLogger,
          proteus,
          keys: [{ algorithm: "ES512", purpose: "token" }],
        });

        await worker.trigger();

        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({ algorithm: "ES512", certificate: undefined }),
        );
      });

      test("should pass ca-signed certificate for non-hidden asymmetric key", async () => {
        mockFind.mockResolvedValueOnce(seedInternalKeys());

        const worker = createKryptosRotationWorker({
          logger: mockLogger,
          proteus,
          rootCaKey,
          keys: [{ algorithm: "ES512", purpose: "token" }],
        });

        await worker.trigger();

        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            algorithm: "ES512",
            certificate: { mode: "ca-signed", ca: rootCaKey },
          }),
        );
      });

      test("should skip certificate when key is hidden", async () => {
        mockFind.mockResolvedValueOnce(seedInternalKeys());

        const worker = createKryptosRotationWorker({
          logger: mockLogger,
          proteus,
          rootCaKey,
          keys: [{ algorithm: "ES512", hidden: true, purpose: "my:hidden" }],
        });

        await worker.trigger();

        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            algorithm: "ES512",
            purpose: "my:hidden",
            certificate: undefined,
          }),
        );
      });

      test("should skip certificate when algorithm is symmetric (oct)", async () => {
        mockFind.mockResolvedValueOnce(seedInternalKeys());

        const worker = createKryptosRotationWorker({
          logger: mockLogger,
          proteus,
          rootCaKey,
          keys: [{ algorithm: "HS256", purpose: "mytoken" }],
        });

        await worker.trigger();

        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            algorithm: "HS256",
            purpose: "mytoken",
            certificate: undefined,
          }),
        );
      });

      test("should pass ca-signed certificate on rotation branch too", async () => {
        mockFind.mockResolvedValueOnce([
          ...seedInternalKeys(),
          { algorithm: "ES512", purpose: "token", expiresAt: future },
        ]);

        const worker = createKryptosRotationWorker({
          logger: mockLogger,
          proteus,
          rootCaKey,
          keys: [{ algorithm: "ES512", purpose: "token" }],
        });

        await worker.trigger();

        expect(mockGenerate).toHaveBeenCalledTimes(1);
        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            algorithm: "ES512",
            certificate: { mode: "ca-signed", ca: rootCaKey },
          }),
        );
      });
    });
  });
});
