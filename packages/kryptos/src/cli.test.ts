import { confirm, input, select } from "@inquirer/prompts";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { KryptosKit } from "./classes/index.js";
import { derive, generate } from "./cli.js";

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
  input: vi.fn(),
  select: vi.fn(),
}));

const mockSelect = select as unknown as Mock;
const mockInput = input as unknown as Mock;
const mockConfirm = confirm as unknown as Mock;

// Runs `generate`, captures its console output, and returns the exported
// `kryptos:…` env string so we can re-import + assert on the real key.
const runGenerate = async (
  options: Parameters<typeof generate>[0] = {},
): Promise<string> => {
  const logs: Array<string> = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: Array<unknown>) => {
    logs.push(args.map(String).join(" "));
  });

  await generate(options);

  spy.mockRestore();

  const match = logs.join("\n").match(/kryptos:\S+/);
  if (!match) throw new Error("no env string in CLI output");
  return match[0];
};

// Same capture pattern for the `derive` command.
const runDerive = async (options: Parameters<typeof derive>[0] = {}): Promise<string> => {
  const logs: Array<string> = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: Array<unknown>) => {
    logs.push(args.map(String).join(" "));
  });

  await derive(options);

  spy.mockRestore();

  const match = logs.join("\n").match(/kryptos:\S+/);
  if (!match) throw new Error("no env string in CLI output");
  return match[0];
};

// A reusable oct seed key exported as its kryptos:… env string.
const seedEnv = (): string =>
  KryptosKit.env.export(KryptosKit.generate.enc.oct({ algorithm: "A256KW" }));

describe("kryptos generate CLI", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockInput.mockReset();
    mockConfirm.mockReset();
  });

  test("generates a plain key when no certificate is requested", async () => {
    mockSelect
      .mockResolvedValueOnce("EC") // type
      .mockResolvedValueOnce("sig") // use
      .mockResolvedValueOnce("ES256"); // algorithm
    mockInput
      .mockResolvedValueOnce("") // purpose
      .mockResolvedValueOnce(""); // expiry
    mockConfirm.mockResolvedValueOnce(false); // no certificate

    const key = KryptosKit.env.import(await runGenerate());

    expect(key.type).toBe("EC");
    expect(key.hasCertificate).toBe(false);
  });

  test("stamps a root-ca certificate when requested", async () => {
    mockSelect
      .mockResolvedValueOnce("EC") // type
      .mockResolvedValueOnce("sig") // use
      .mockResolvedValueOnce("ES384") // algorithm
      .mockResolvedValueOnce("root-ca"); // certificate mode
    mockInput
      .mockResolvedValueOnce("") // purpose
      .mockResolvedValueOnce("") // expiry
      .mockResolvedValueOnce("Lindorm Root CA") // subject
      .mockResolvedValueOnce("Lindorm") // organization
      .mockResolvedValueOnce("") // SANs
      .mockResolvedValueOnce("1"); // path length constraint
    mockConfirm.mockResolvedValueOnce(true); // wants a certificate

    const key = KryptosKit.env.import(await runGenerate());

    expect(key.hasCertificate).toBe(true);
    expect(key.certificateThumbprint).toBeTruthy();
    expect(key.certificateChain.length).toBeGreaterThan(0);
  });

  test("never offers a certificate for symmetric (oct) keys", async () => {
    mockSelect
      .mockResolvedValueOnce("oct") // type
      .mockResolvedValueOnce("sig") // use
      .mockResolvedValueOnce("HS256"); // algorithm
    mockInput
      .mockResolvedValueOnce("") // purpose
      .mockResolvedValueOnce(""); // expiry

    const key = KryptosKit.env.import(await runGenerate());

    expect(key.type).toBe("oct");
    expect(key.hasCertificate).toBe(false);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test("runs fully from flags with no prompts (scriptable root-ca)", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({
        type: "EC",
        use: "sig",
        algorithm: "ES384",
        certificate: "root-ca",
        subject: "Lindorm Root CA",
        organization: "Lindorm",
        pathLength: "1",
      }),
    );

    expect(key.hasCertificate).toBe(true);
    expect(key.certificateChain.length).toBeGreaterThan(0);
    // Zero prompts — a scripted run must not block on stdin.
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInput).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test("accepts the parent CA via --ca for a ca-signed cert (no prompts)", async () => {
    const rootCaEnv = KryptosKit.env.export(
      KryptosKit.generate.auto({
        algorithm: "ES384",
        certificate: {
          mode: "root-ca",
          subject: "Lindorm Root CA",
          organization: "Lindorm",
        },
      }),
    );

    const leaf = KryptosKit.env.import(
      await runGenerate({
        type: "EC",
        use: "sig",
        algorithm: "ES256",
        certificate: "ca-signed",
        ca: rootCaEnv,
        subject: "tyr.lindorm.io",
      }),
    );

    expect(leaf.hasCertificate).toBe(true);
    // Chain carries the signing CA cert as well as the leaf.
    expect(leaf.certificateChain.length).toBeGreaterThanOrEqual(2);
    expect(mockInput).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test("honours --curve for a multi-curve algorithm (Ed448) with no prompts", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({
        type: "OKP",
        use: "sig",
        algorithm: "EdDSA",
        curve: "Ed448",
      }),
    );

    expect(key.type).toBe("OKP");
    expect(key.curve).toBe("Ed448");
    expect(mockSelect).not.toHaveBeenCalled();
  });

  test("defaults the curve when --curve is omitted (EdDSA → Ed25519)", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({ type: "OKP", use: "sig", algorithm: "EdDSA" }),
    );

    expect(key.curve).toBe("Ed25519");
  });

  test("honours --expiry as a duration (20y) with no prompts", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({
        type: "OKP",
        use: "sig",
        algorithm: "EdDSA",
        curve: "Ed448",
        expiry: "20y",
      }),
    );

    expect(key.curve).toBe("Ed448");
    expect(key.expiresAt.getFullYear()).toBe(new Date().getFullYear() + 20);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInput).not.toHaveBeenCalled();
  });

  test("defaults expiry to the library window (25y) when --expiry is omitted", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({ type: "EC", use: "sig", algorithm: "ES256" }),
    );

    expect(key.expiresAt.getFullYear()).toBe(new Date().getFullYear() + 25);
  });

  test("rejects a curve that does not match the algorithm", async () => {
    await expect(
      runGenerate({ type: "OKP", use: "sig", algorithm: "EdDSA", curve: "P-256" }),
    ).rejects.toThrow(/Invalid Curve|not valid/i);

    await expect(
      runGenerate({ type: "EC", use: "sig", algorithm: "ES256", curve: "P-384" }),
    ).rejects.toThrow(/Invalid Curve|not valid/i);
  });

  test("rejects an unparseable --expiry duration", async () => {
    await expect(
      runGenerate({ type: "EC", use: "sig", algorithm: "ES256", expiry: "banana" }),
    ).rejects.toThrow(/Invalid Expiry|not a valid duration/i);
  });
});

describe("kryptos derive CLI", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockInput.mockReset();
    mockConfirm.mockReset();
  });

  test("derives an oct key fully from flags with no prompts", async () => {
    const key = KryptosKit.env.import(
      await runDerive({
        type: "oct",
        use: "enc",
        algorithm: "A256KW",
        seed: seedEnv(),
        path: "urn:lindorm:tyr:kek:v1",
      }),
    );

    expect(key.type).toBe("oct");
    expect(key.hasPrivateKey).toBe(true);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInput).not.toHaveBeenCalled();
  });

  test("derives deterministically for the same seed + path (full env string, id included)", async () => {
    // The env JWK embeds second-resolution iat/nbf/exp; pin the clock so a
    // literal full-env comparison isn't flaky across a second boundary.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    try {
      const seed = seedEnv();
      const opts = {
        type: "oct" as const,
        use: "enc",
        algorithm: "A256KW",
        seed,
        path: "urn:lindorm:tyr:kek:v1",
      };

      const envA = await runDerive(opts);
      const envB = await runDerive(opts);

      // The whole env string must match — ciphertexts embed the key id, so the
      // id has to be reproduced on re-derivation, not just the key material.
      expect(envA).toBe(envB);

      const a = KryptosKit.env.import(envA);
      const b = KryptosKit.env.import(envB);
      expect(a.id).toBe(b.id);
      expect(a.id).toMatch(/^key_[A-Za-z0-9]{16}$/);
      expect(a.export("der").privateKey).toEqual(b.export("der").privateKey);
    } finally {
      vi.useRealTimers();
    }
  });

  test("derives a different key when the path version bumps", async () => {
    const seed = seedEnv();

    const v1 = KryptosKit.env.import(
      await runDerive({
        type: "oct",
        use: "enc",
        algorithm: "A256KW",
        seed,
        path: "urn:lindorm:tyr:kek:v1",
      }),
    );
    const v2 = KryptosKit.env.import(
      await runDerive({
        type: "oct",
        use: "enc",
        algorithm: "A256KW",
        seed,
        path: "urn:lindorm:tyr:kek:v2",
      }),
    );

    expect(v1.export("der").privateKey).not.toEqual(v2.export("der").privateKey);
  });

  test("rejects a non-oct --type", async () => {
    await expect(
      runDerive({
        type: "EC",
        use: "sig",
        algorithm: "A256KW",
        seed: seedEnv(),
        path: "urn:lindorm:tyr:kek:v1",
      }),
    ).rejects.toThrow(/only supports 'oct'|Unsupported Derive Key Type/i);
  });

  test("rejects a missing --seed in scripted mode", async () => {
    await expect(
      runDerive({
        type: "oct",
        use: "enc",
        algorithm: "A256KW",
        path: "urn:lindorm:tyr:kek:v1",
      }),
    ).rejects.toThrow(/Missing Seed Key|seed key is required/i);
  });

  test("rejects a missing --path in scripted mode", async () => {
    await expect(
      runDerive({
        type: "oct",
        use: "enc",
        algorithm: "A256KW",
        seed: seedEnv(),
      }),
    ).rejects.toThrow(/Missing Derivation Path|derivation path is required/i);
  });

  test("rejects a non-oct seed key", async () => {
    const ecSeed = KryptosKit.env.export(
      KryptosKit.generate.sig.ec({ algorithm: "ES256" }),
    );

    await expect(
      runDerive({
        type: "oct",
        use: "enc",
        algorithm: "A256KW",
        seed: ecSeed,
        path: "urn:lindorm:tyr:kek:v1",
      }),
    ).rejects.toThrow(/Invalid seed key type/i);
  });
});
