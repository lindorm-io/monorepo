import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { LindormWorker } from "@lindorm/worker";
import { Kryptos } from "../entities/Kryptos.js";
import { createKryptosRotationWorker } from "./kryptos-rotation-worker.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const {
  mockGenerate,
  mockFind,
  mockCreate,
  mockInsert,
  mockRepository,
  mockGetTypeForAlgorithm,
} = vi.hoisted(() => {
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
  return {
    mockGenerate: vi.fn().mockReturnValue({
      use: "sig",
      toDB: () => ({
        id: "new-key-id",
        algorithm: "ES512",
        privateKey: "generated-private-key",
      }),
    }),
    mockFind: vi.fn().mockResolvedValue([]),
    mockCreate: vi.fn().mockImplementation((data: any) => data),
    mockInsert: vi.fn().mockImplementation((entity: any) => ({
      ...entity,
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    })),
    mockRepository: vi.fn(),
    mockGetTypeForAlgorithm: vi.fn((algorithm: string) =>
      octAlgorithms.has(algorithm) ? "oct" : "EC",
    ),
  };
});
mockRepository.mockReturnValue({
  find: mockFind,
  create: mockCreate,
  insert: mockInsert,
});

const mockLogger = createMockLogger();

vi.mock("@lindorm/kryptos", async () => ({
  KryptosKit: {
    generate: { auto: mockGenerate },
    getTypeForAlgorithm: mockGetTypeForAlgorithm,
  },
}));

const future = new Date("2030-01-01T00:00:00.000Z");

// The key set `@lindorm/create-pylon` scaffolds into a generated app. The worker
// itself has NO default set — this is a deployment's list, and it lives here to
// prove the worker mints exactly what it is given, with the `publish` flags it is
// given.
const scaffoldKeys = () => [
  { algorithm: "dir", publish: false, purpose: "cookie", expiry: "1y" },
  { algorithm: "HS256", publish: false, purpose: "cookie", expiry: "1y" },
  {
    algorithm: "EdDSA",
    curve: "Ed448",
    publish: false,
    purpose: "session",
    expiry: "1y",
  },
  {
    algorithm: "ECDH-ES",
    curve: "X448",
    publish: false,
    purpose: "session",
    expiry: "1y",
  },
  {
    algorithm: "EdDSA",
    curve: "Ed25519",
    publish: true,
    purpose: "token",
    expiry: "6mo",
  },
  {
    algorithm: "ECDH-ES+A256GCMKW",
    curve: "X448",
    publish: true,
    purpose: "token",
    expiry: "6mo",
  },
];

describe("createKryptosRotationWorker", () => {
  const db: any = { repository: mockRepository };

  class FakeKryptosDB {}

  beforeEach(() => {
    vi.clearAllMocks();
    (mockLogger.child as Mock).mockImplementation(() => mockLogger);
    mockFind.mockResolvedValue([]);
    mockGenerate.mockReturnValue({
      use: "sig",
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
    const worker = createKryptosRotationWorker({ logger: mockLogger, db });

    expect(worker).toBeInstanceOf(LindormWorker);
    expect(worker.alias).toBe("KryptosRotationWorker");
  });

  test("should accept interval override without throwing", () => {
    expect(() =>
      createKryptosRotationWorker({ logger: mockLogger, db, interval: "12h" }),
    ).not.toThrow();
  });

  describe("callback", () => {
    test("should default repository target to Kryptos entity when target not provided", async () => {
      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockRepository).toHaveBeenCalledWith(Kryptos);
    });

    test("should use provided target override when supplied", async () => {
      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
        target: FakeKryptosDB as any,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockRepository).toHaveBeenCalledWith(FakeKryptosDB);
    });

    // The magic is GONE, not moved. The worker only needed a default key list
    // because pylon GUESSED which key each of its roles wanted, so the keys had
    // to exist by convention. The options name them now — so a worker with no
    // keys mints nothing, and says so.
    test("should mint nothing and warn when no keys are configured", async () => {
      const worker = createKryptosRotationWorker({ logger: mockLogger, db });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Kryptos rotation worker has no keys configured, nothing will be rotated",
        expect.any(Object),
      );

      await worker.trigger();

      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockRepository).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    test("should not warn when keys are configured", () => {
      createKryptosRotationWorker({
        logger: mockLogger,
        db,
        keys: [{ algorithm: "ES512", publish: true, purpose: "token" }],
      });

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test("should use provided keys", async () => {
      const keys = [{ algorithm: "ES256", purpose: "test" }];

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
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
        db,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "No existing keys found, generating initial key",
        {
          algorithm: "ES512",
          purpose: "token",
          use: "sig",
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
        db,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Only one key found, generating rotation key",
        {
          algorithm: "ES512",
          purpose: "token",
          use: "sig",
        },
      );
    });

    test("should not create keys when two or more existing keys found", async () => {
      mockFind.mockResolvedValueOnce([
        { algorithm: "ES512", purpose: "token", expiresAt: future },
        { algorithm: "ES512", purpose: "token", expiresAt: future },
      ]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    test("should filter existing keys by algorithm and purpose", async () => {
      mockFind.mockResolvedValueOnce([
        { algorithm: "ES512", purpose: "token", expiresAt: future },
        { algorithm: "ES512", purpose: "token", expiresAt: future },
      ]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
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
        { algorithm: "ES512", purpose: "token", expiresAt: past },
      ]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
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
        { algorithm: "ES512", purpose: "token", expiresAt: past },
        { algorithm: "ES512", purpose: "token", expiresAt: future },
      ]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Only one key found, generating rotation key",
        expect.objectContaining({ algorithm: "ES512", purpose: "token" }),
      );
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    test("should default token keys to a 6mo expiry (months, not minutes)", async () => {
      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      const call = mockGenerate.mock.calls[0][0];
      expect(call.algorithm).toBe("ES512");
      expect(call.purpose).toBe("token");
      expect(call.notBefore).toBeInstanceOf(Date);
      expect(call.expiresAt).toBeInstanceOf(Date);

      // Guard the "6m" (6 minutes) vs "6mo" (6 months) unit trap: the default
      // must be ~6 months out, not a few minutes.
      const days = (call.expiresAt.getTime() - call.notBefore.getTime()) / 86_400_000;
      expect(days).toBeGreaterThan(150);
      expect(days).toBeLessThan(200);
    });

    test("adds freshly-minted keys to the amphora in one batch when provided", async () => {
      mockFind.mockResolvedValueOnce([]); // fresh — everything gets minted

      const amphora = { add: vi.fn() } as any;

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
        amphora,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      expect(amphora.add).toHaveBeenCalledTimes(1);
      expect(Array.isArray(amphora.add.mock.calls[0][0])).toBe(true);
      expect(amphora.add.mock.calls[0][0].length).toBeGreaterThan(0);
    });

    test("works without an amphora (it is optional)", async () => {
      mockFind.mockResolvedValueOnce([]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await expect(worker.trigger()).resolves.not.toThrow();
    });

    // The worker mints EXACTLY the keys it is given, with the `publish` flags it
    // is given — no additions of its own. `publish` defaults to FALSE in kryptos,
    // so the two token keys MUST come out `true` — if they ever come out `false`
    // the JWKS silently empties and no RP can verify a thing. And the four
    // internal keys MUST come out `false` — a published cookie or session key is
    // a silent exposure. Both directions are checked; neither is a snapshot to
    // bless.
    test("mints exactly the keys it is given, with the publish flags it is given", async () => {
      mockFind.mockResolvedValueOnce([]); // fresh vault — the whole set is minted

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
        keys: scaffoldKeys() as any,
      });

      await worker.trigger();

      const calls = mockGenerate.mock.calls.map((c) => c[0]);

      const internal = calls.filter(
        (c) => c.purpose === "cookie" || c.purpose === "session",
      );
      const published = calls.filter((c) => c.purpose === "token");

      // On a fresh vault each key is minted TWICE — the current key and its
      // rotation successor — so 6 configured keys produce 12 generate calls.
      expect(internal).toHaveLength(8);
      expect(published).toHaveLength(4);

      for (const key of internal) {
        expect(key.publish).toBe(false);
      }
      for (const key of published) {
        expect(key.publish).toBe(true);
      }

      // and the token keys are the sig + enc pair an RP actually needs
      expect(new Set(published.map((c) => c.algorithm))).toEqual(
        new Set(["EdDSA", "ECDH-ES+A256GCMKW"]),
      );
      expect(new Set(internal.map((c) => c.algorithm))).toEqual(
        new Set(["dir", "HS256", "EdDSA", "ECDH-ES"]),
      );
    });

    test("a caller-supplied key set is NOT published unless it says so", async () => {
      mockFind.mockResolvedValueOnce([]);

      const worker = createKryptosRotationWorker({
        logger: mockLogger,
        db,
        keys: [{ algorithm: "ES512", purpose: "token" }],
      });

      await worker.trigger();

      const override = mockGenerate.mock.calls
        .map((c) => c[0])
        .find((c) => c.algorithm === "ES512");

      // Fail-closed: an override that forgets `publish` gets the kryptos default
      // (false). This is intentional — see the `keys` doc comment on the worker.
      expect(override.publish).toBeUndefined();
    });

    describe("rootCaKey", () => {
      const rootCaKey = { id: "root-ca-id" } as any;

      test("should not pass certificate when rootCaKey is unset", async () => {
        const worker = createKryptosRotationWorker({
          logger: mockLogger,
          db,
          keys: [{ algorithm: "ES512", publish: true, purpose: "token" }],
        });

        await worker.trigger();

        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({ algorithm: "ES512", certificate: undefined }),
        );
      });

      test("should pass ca-signed certificate for published asymmetric key", async () => {
        const worker = createKryptosRotationWorker({
          logger: mockLogger,
          db,
          rootCaKey,
          keys: [{ algorithm: "ES512", publish: true, purpose: "token" }],
        });

        await worker.trigger();

        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            algorithm: "ES512",
            certificate: { mode: "ca-signed", ca: rootCaKey },
          }),
        );
      });

      // A cert exists to let an RP build trust to a key it can see. An internal key
      // has no relying party, so it gets no chain.
      test("should skip certificate when key is not published", async () => {
        const worker = createKryptosRotationWorker({
          logger: mockLogger,
          db,
          rootCaKey,
          keys: [{ algorithm: "ES512", publish: false, purpose: "my:internal" }],
        });

        await worker.trigger();

        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            algorithm: "ES512",
            purpose: "my:internal",
            certificate: undefined,
          }),
        );
      });

      test("should skip certificate when algorithm is symmetric (oct)", async () => {
        const worker = createKryptosRotationWorker({
          logger: mockLogger,
          db,
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
          { algorithm: "ES512", purpose: "token", expiresAt: future },
        ]);

        const worker = createKryptosRotationWorker({
          logger: mockLogger,
          db,
          rootCaKey,
          keys: [{ algorithm: "ES512", publish: true, purpose: "token" }],
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
