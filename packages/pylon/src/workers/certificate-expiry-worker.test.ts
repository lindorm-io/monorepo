import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { LindormWorker } from "@lindorm/worker";
import MockDate from "mockdate";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  type Mock,
  test,
  vi,
} from "vitest";
import { createCertificateExpiryWorker } from "./certificate-expiry-worker.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");
const days = (n: number): Date => new Date(NOW.getTime() + n * 86_400_000);

const root = (subject: string, expiresAt: Date): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "ES384",
    notBefore: days(-365),
    expiresAt,
    certificate: { mode: "root-ca", subject, pathLengthConstraint: 2 },
  });

const leaf = (subject: string, expiresAt: Date, ca: IKryptos): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "ES256",
    notBefore: days(-60),
    expiresAt,
    certificate: { mode: "ca-signed", ca, subject },
  });

const mockLogger = createMockLogger();

const run = async (vault: Array<IKryptos>, overrides = {}): Promise<void> => {
  const amphora = createMockAmphora();
  amphora.vault = vault;
  const worker = createCertificateExpiryWorker({
    amphora,
    logger: mockLogger,
    ...overrides,
  });
  await worker.trigger();
};

describe("createCertificateExpiryWorker", () => {
  beforeAll(() => MockDate.set(NOW));
  afterAll(() => MockDate.reset());

  beforeEach(() => {
    vi.clearAllMocks();
    // Make ctx.logger (a child) the same mock so we can assert on it.
    (mockLogger.child as Mock).mockImplementation(() => mockLogger);
  });

  test("returns a LindormWorker with the correct alias and default cron", () => {
    const amphora = createMockAmphora();
    const worker = createCertificateExpiryWorker({ amphora, logger: mockLogger });

    expect(worker).toBeInstanceOf(LindormWorker);
    expect(worker.alias).toBe("CertificateExpiryWorker");
    expect(() =>
      createCertificateExpiryWorker({ amphora, logger: mockLogger, cron: "0 3 * * *" }),
    ).not.toThrow();
    // An explicit interval override must not collide with the default cron.
    expect(() =>
      createCertificateExpiryWorker({ amphora, logger: mockLogger, interval: "12h" }),
    ).not.toThrow();
  });

  test("a cert more than the warn threshold away is silent", async () => {
    const ca = root("Root CA", days(3650));
    await run([leaf("healthy", days(200), ca)]); // ~6.5mo

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test("a cert within the warn threshold (1-3mo) logs warn", async () => {
    const ca = root("Root CA", days(3650));
    await run([leaf("soon", days(60), ca)]); // ~2mo

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    const [, data] = (mockLogger.warn as Mock).mock.calls[0];
    expect(data.subject).toBe("soon");
    expect(data.daysRemaining).toBeGreaterThan(0);
    expect(data.kids).toHaveLength(1);
  });

  test("a cert within the error threshold (<1mo) logs error", async () => {
    const ca = root("Root CA", days(3650));
    await run([leaf("urgent", days(14), ca)]);

    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const [, data] = (mockLogger.error as Mock).mock.calls[0];
    expect(data.subject).toBe("urgent");
  });

  test("an already-expired cert logs error with negative days remaining", async () => {
    const ca = root("Root CA", days(3650));
    await run([leaf("dead", days(-1), ca)]);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const [, data] = (mockLogger.error as Mock).mock.calls[0];
    expect(data.daysRemaining).toBeLessThan(0);
  });

  test("dedupes a shared CA cert to one line, annotated with every referencing kid", async () => {
    const ca = root("Shared CA", days(60)); // ~2mo → warn
    const a = leaf("svc-a", days(45), ca);
    const b = leaf("svc-b", days(45), ca);

    await run([a, b]);

    // Three distinct certs: two leaves + the shared CA (deduped).
    const [, summary] = (mockLogger.verbose as Mock).mock.calls[0];
    expect(summary.checked).toBe(3);

    // The CA is logged exactly once, referencing BOTH leaf kids.
    const caLines = (mockLogger.warn as Mock).mock.calls.filter(
      ([, data]) => data.subject === "Shared CA",
    );
    expect(caLines).toHaveLength(1);
    expect(caLines[0][1].kids.sort()).toEqual([a.id, b.id].sort());
  });

  test("ignores keys without a certificate", async () => {
    const oct = KryptosKit.generate.auto({ algorithm: "A256KW" });
    await run([oct]);

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    const [, summary] = (mockLogger.verbose as Mock).mock.calls[0];
    expect(summary.checked).toBe(0);
  });

  test("honours threshold overrides", async () => {
    const ca = root("Root CA", days(3650));
    // 120 days (~4mo): healthy under defaults, but warn under a 6mo/2mo window.
    await run([leaf("mid", days(120), ca)], {
      warnThreshold: "6mo",
      errorThreshold: "2mo",
    });

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test("logs a verbose summary with checked/warn/error counts", async () => {
    const ca = root("Root CA", days(3650));
    await run([leaf("warnme", days(60), ca), leaf("errme", days(10), ca)]);

    const [message, summary] = (mockLogger.verbose as Mock).mock.calls[0];
    expect(message).toMatch(/Certificate expiry check complete/);
    expect(summary).toMatchObject({ checked: 3, warn: 1, error: 1 });
  });
});
