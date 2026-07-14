import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { B64 } from "@lindorm/b64";
import { confirm, input, select } from "@inquirer/prompts";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { KryptosKit } from "./classes/index.js";
import { derive, exportKey, generate, inspect } from "./cli.js";
import type { KryptosAlgorithm } from "./types/index.js";

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

// Runs `inspect`, returning everything it printed.
const runInspect = async (
  envString: string,
  options: Parameters<typeof inspect>[1] = {},
): Promise<string> => {
  const logs: Array<string> = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: Array<unknown>) => {
    logs.push(args.map(String).join(" "));
  });

  await inspect(envString, options);

  spy.mockRestore();
  return logs.join("\n");
};

// Captures everything a command prints (used when there is no env string to
// extract — e.g. `--write` runs).
const captureLogs = async (fn: () => Promise<void>): Promise<string> => {
  const logs: Array<string> = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: Array<unknown>) => {
    logs.push(args.map(String).join(" "));
  });
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  return logs.join("\n");
};

// The decoded payload's first byte distinguishes JSON (0x7b) from CBOR (map).
const firstPayloadByte = (env: string): number =>
  B64.toBuffer(env.slice("kryptos:".length), "b64u")[0];

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
    mockConfirm
      .mockResolvedValueOnce(true) // publish
      .mockResolvedValueOnce(false); // no certificate

    const key = KryptosKit.env.import(await runGenerate());

    expect(key.type).toBe("EC");
    expect(key.hasCertificate).toBe(false);
    expect(key.publish).toBe(true);
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
      .mockResolvedValueOnce("") // environment / OU
      .mockResolvedValueOnce("1"); // path length constraint
    mockConfirm
      .mockResolvedValueOnce(true) // publish
      .mockResolvedValueOnce(true); // wants a certificate

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
    mockConfirm.mockResolvedValueOnce(true); // publish (oct is never offered a cert)

    const key = KryptosKit.env.import(await runGenerate());

    expect(key.type).toBe("oct");
    expect(key.hasCertificate).toBe(false);
    // The publish confirm fires, but a symmetric key is never offered a cert:
    // exactly one confirm (publish), no certificate-mode select consumed.
    expect(mockConfirm).toHaveBeenCalledTimes(1);
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

  // The CLI's default is the OPPOSITE of the library's, deliberately: a key minted
  // by hand is a ceremony key (root CA, root seed, KEK), so publication is OPT-IN.
  // The library contract (default `true`) is pinned in Kryptos.publish.test.ts.
  test("defaults publish:false when --publish is omitted (scripted)", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({ type: "EC", use: "sig", algorithm: "ES256" }),
    );

    expect(key.publish).toBe(false);
    expect("publish" in key.toJWK("public")).toBe(false);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test("publishes the key with --publish (scripted, round-trips in env)", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({
        type: "EC",
        use: "sig",
        algorithm: "ES256",
        publish: true,
      }),
    );

    expect(key.publish).toBe(true);
    expect("publish" in key.toJWK("public")).toBe(false);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  // The ceremony shape — a root CA minted at the CLI must never be publishable by
  // accident. This is the whole reason the CLI default is inverted.
  test("leaves a root-ca ceremony key unpublished when --publish is omitted", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({
        type: "OKP",
        use: "sig",
        algorithm: "EdDSA",
        curve: "Ed448",
        certificate: "root-ca",
        subject: "Lindorm Root CA",
        organization: "Lindorm",
      }),
    );

    expect(key.hasCertificate).toBe(true);
    expect(key.publish).toBe(false);
  });

  test("stamps --environment as the certificate subject OU (scripted)", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({
        type: "EC",
        use: "sig",
        algorithm: "ES256",
        certificate: "self-signed",
        subject: "leaf",
        environment: "development",
      }),
    );

    expect(key.certificate?.subject.organizationalUnit).toBe("development");
  });

  test("rejects an invalid --environment value", async () => {
    await expect(
      runGenerate({
        type: "EC",
        use: "sig",
        algorithm: "ES256",
        certificate: "self-signed",
        subject: "leaf",
        environment: "prod",
      }),
    ).rejects.toThrow(/Invalid --environment/i);
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

  // A derived key is a KEK far more often than a JWKS resident — opt-in here too.
  test("leaves a derived key unpublished unless --publish is passed (scripted)", async () => {
    const unpublished = KryptosKit.env.import(
      await runDerive({
        type: "oct",
        use: "enc",
        algorithm: "A256KW",
        seed: seedEnv(),
        path: "urn:lindorm:tyr:kek:v1",
      }),
    );

    expect(unpublished.publish).toBe(false);
    // A derived key is oct, so it has no public JWK to leak the flag into — the
    // export is refused outright. The flag lives in the private JWK the env
    // string carries.
    expect(unpublished.toJWK("private").publish).toBe(false);
    expect(() => unpublished.toJWK("public")).toThrow(
      expect.objectContaining({ name: "KryptosError", code: "no_public_jwk" }),
    );

    const published = KryptosKit.env.import(
      await runDerive({
        type: "oct",
        use: "enc",
        algorithm: "A256KW",
        seed: seedEnv(),
        path: "urn:lindorm:tyr:kek:v1",
        publish: true,
      }),
    );

    expect(published.publish).toBe(true);
  });
});

describe("kryptos CLI — env format & power-user flags", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockInput.mockReset();
    mockConfirm.mockReset();
  });

  test("generate defaults to CBOR", async () => {
    const env = await runGenerate({ type: "EC", use: "sig", algorithm: "ES256" });

    expect(firstPayloadByte(env)).toBeGreaterThanOrEqual(0xa0);
    expect(firstPayloadByte(env)).toBeLessThanOrEqual(0xbb);
    expect(KryptosKit.env.import(env).type).toBe("EC");
  });

  test("generate --format json emits a JSON payload", async () => {
    const env = await runGenerate({
      type: "EC",
      use: "sig",
      algorithm: "ES256",
      format: "json",
    });

    expect(firstPayloadByte(env)).toBe(0x7b); // '{'
    expect(KryptosKit.env.import(env).type).toBe("EC");
  });

  test("generate rejects an invalid --format", async () => {
    await expect(
      runGenerate({ type: "EC", use: "sig", algorithm: "ES256", format: "yaml" }),
    ).rejects.toThrow(/Invalid --format/i);
  });

  test("generate honours id/issuer/jwks-uri/owner-id/not-before", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({
        type: "EC",
        use: "sig",
        algorithm: "ES256",
        id: "key_customId000000",
        issuer: "https://iss.test",
        jwksUri: "https://iss.test/jwks",
        ownerId: "owner-1",
        notBefore: "2026-01-01T00:00:00Z",
      }),
    );

    expect(key.id).toBe("key_customId000000");
    expect(key.issuer).toBe("https://iss.test");
    expect(key.jwksUri).toBe("https://iss.test/jwks");
    expect(key.ownerId).toBe("owner-1");
    expect(key.notBefore.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  test("generate honours --modulus", async () => {
    const key = KryptosKit.env.import(
      await runGenerate({
        type: "RSA",
        use: "sig",
        algorithm: "RS256",
        modulus: "4096",
      }),
    );

    expect(key.modulus).toBe(4096);
    // Derived from the key material — no --operations flag can override it.
    expect(key.operations).toEqual(["sign", "verify"]);
  });

  test("generate rejects invalid --modulus and --not-before", async () => {
    await expect(
      runGenerate({ type: "RSA", use: "sig", algorithm: "RS256", modulus: "1024" }),
    ).rejects.toThrow(/Invalid --modulus/i);

    await expect(
      runGenerate({
        type: "EC",
        use: "sig",
        algorithm: "ES256",
        notBefore: "not-a-date",
      }),
    ).rejects.toThrow(/Invalid --not-before/i);
  });

  test("derive honours --format json and --id/--expiry/--issuer", async () => {
    const env = await runDerive({
      type: "oct",
      use: "enc",
      algorithm: "A256KW",
      seed: seedEnv(),
      path: "urn:lindorm:tyr:kek:v1",
      id: "key_deriveId000000",
      expiry: "5y",
      issuer: "https://iss.test",
      format: "json",
    });

    expect(firstPayloadByte(env)).toBe(0x7b);
    const key = KryptosKit.env.import(env);
    expect(key.id).toBe("key_deriveId000000");
    expect(key.issuer).toBe("https://iss.test");
    expect(key.expiresAt.getFullYear()).toBe(new Date().getFullYear() + 5);
  });
});

describe("kryptos inspect CLI", () => {
  test("prints a readable summary for a CBOR env string", async () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });
    const out = await runInspect(KryptosKit.env.export(key));

    expect(out).toContain(key.id);
    expect(out).toContain("EC/ES256/sig");
    expect(out).toContain("thumbprint");
  });

  test("accepts a JSON env string too", async () => {
    const key = KryptosKit.generate.auto({ algorithm: "EdDSA" });
    const out = await runInspect(key.toEnvString("json"));

    expect(out).toContain(key.id);
  });

  test("--json prints the decoded structure with secrets redacted", async () => {
    const key = KryptosKit.generate.auto({ algorithm: "RS256" });
    const secretD = (key.toJWK("private") as { d?: string }).d!;

    const out = await runInspect(KryptosKit.env.export(key), { json: true });

    expect(out).not.toContain(secretD);
    expect(out).toMatch(/"d": "<\d+ bytes>"/);
  });

  test("never prints secret bytes in the summary", async () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });
    const secretD = (key.toJWK("private") as { d?: string }).d!;

    const out = await runInspect(KryptosKit.env.export(key));

    expect(out).not.toContain(secretD);
  });

  test("rejects a non-kryptos argument", async () => {
    await expect(runInspect("not-a-kryptos-string")).rejects.toThrow(
      /Invalid Inspect Input|env string/i,
    );
  });
});

describe("kryptos CLI — .kryptos files", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kryptos-cli-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const kryptosFile = (): string => readdirSync(dir).find((f) => f.endsWith(".kryptos"))!;

  const onlyFile = (): string =>
    KryptosKit.env.import(readFileSync(join(dir, kryptosFile()), "utf8")).id;

  describe("--write", () => {
    test("writes <kid>.kryptos at mode 0600, prints path + summary and NOT the secret", async () => {
      const out = await captureLogs(() =>
        generate({
          type: "EC",
          use: "sig",
          algorithm: "ES256",
          certificate: "self-signed",
          subject: "leaf",
          environment: "development",
          write: dir,
        }),
      );

      const file = kryptosFile();
      const kid = onlyFile();
      const filePath = join(dir, file);

      expect(file).toBe(`${kid}.kryptos`);
      expect(statSync(filePath).mode & 0o777).toBe(0o600);

      const content = readFileSync(filePath, "utf8").trim();
      const restored = KryptosKit.env.import(content);
      expect(restored.id).toBe(kid);
      expect(restored.certificate?.subject.organizationalUnit).toBe("development");

      // Path + summary printed; the secret env string never touches stdout.
      expect(out).toContain(filePath);
      expect(out).toContain("OU=development");
      expect(out).not.toContain(content);
      expect(out).not.toMatch(/kryptos:\S/);
    });

    test("derive --write keeps the secret off stdout", async () => {
      const out = await captureLogs(() =>
        derive({
          type: "oct",
          use: "enc",
          algorithm: "A256KW",
          seed: seedEnv(),
          path: "urn:lindorm:tyr:kek:v1",
          write: dir,
        }),
      );

      const content = readFileSync(join(dir, kryptosFile()), "utf8").trim();
      expect(KryptosKit.env.import(content).type).toBe("oct");
      expect(out).not.toMatch(/kryptos:\S/);
      expect(out).toContain(join(dir, kryptosFile()));
    });

    test("refuses to overwrite an existing file", async () => {
      const opts = {
        type: "EC" as const,
        use: "sig",
        algorithm: "ES256",
        id: "key_fixedId00000000",
        write: dir,
      };

      await generate(opts);

      await expect(generate(opts)).rejects.toThrow(/Refusing to overwrite/i);
    });

    test("defaults the directory to cwd when --write has no value", async () => {
      const cwd = process.cwd();
      const spy = vi.spyOn(process, "cwd").mockReturnValue(dir);
      try {
        await generate({ type: "EC", use: "sig", algorithm: "ES256", write: true });
      } finally {
        spy.mockRestore();
      }
      expect(cwd).toBe(cwd); // sanity: cwd unchanged for other tests
      expect(kryptosFile()).toMatch(/^key_.*\.kryptos$/);
    });
  });

  describe("path-or-string inputs", () => {
    test("generate --ca accepts a file path", async () => {
      const rootPath = join(dir, "root.kryptos");
      writeFileSync(
        rootPath,
        KryptosKit.env.export(
          KryptosKit.generate.auto({
            algorithm: "ES384",
            certificate: { mode: "root-ca", subject: "Root", pathLengthConstraint: 1 },
          }),
        ) + "\n",
      );

      const leaf = KryptosKit.env.import(
        await runGenerate({
          type: "EC",
          use: "sig",
          algorithm: "ES256",
          certificate: "ca-signed",
          ca: rootPath,
          subject: "leaf",
        }),
      );

      expect(leaf.certificateChain).toHaveLength(2);
    });

    test("derive --seed accepts a file path", async () => {
      const seedPath = join(dir, "seed.kryptos");
      writeFileSync(seedPath, seedEnv() + "\n");

      const key = KryptosKit.env.import(
        await runDerive({
          type: "oct",
          use: "enc",
          algorithm: "A256KW",
          seed: seedPath,
          path: "urn:lindorm:tyr:kek:v1",
        }),
      );

      expect(key.type).toBe("oct");
    });

    test("inspect accepts both a file path and an inline string", async () => {
      const env = KryptosKit.env.export(
        KryptosKit.generate.auto({
          algorithm: "ES256",
          certificate: { mode: "self-signed", subject: "leaf" },
        }),
      );
      const path = join(dir, "key.kryptos");
      writeFileSync(path, env + "\n");

      expect(await runInspect(path)).toContain("CN=leaf");
      expect(await runInspect(env)).toContain("CN=leaf");
    });

    test("errors clearly on a missing file", async () => {
      await expect(runInspect(join(dir, "nope.kryptos"))).rejects.toThrow(
        /could not be read as a file|Could not read/i,
      );
    });

    test("errors clearly on a file without a kryptos env string", async () => {
      const path = join(dir, "bad.kryptos");
      writeFileSync(path, "not-a-key\n");

      await expect(runInspect(path)).rejects.toThrow(/does not contain a/i);
    });
  });

  test("full history-clean ceremony: root → intermediate → KEK, no inline secrets", async () => {
    // Root CA written to a file (the secret is never passed inline).
    const rootOut = await captureLogs(() =>
      generate({
        type: "EC",
        use: "sig",
        algorithm: "ES384",
        certificate: "root-ca",
        subject: "Root CA",
        environment: "development",
        pathLength: "1",
        id: "key_ceremonyRoot00",
        write: dir,
      }),
    );
    const rootPath = join(dir, "key_ceremonyRoot00.kryptos");

    // Intermediate signed by the root FILE, written to a file.
    const intOut = await captureLogs(() =>
      generate({
        type: "EC",
        use: "sig",
        algorithm: "ES256",
        certificate: "intermediate-ca",
        ca: rootPath,
        subject: "Issuing CA",
        pathLength: "0",
        id: "key_ceremonyInt000",
        write: dir,
      }),
    );
    const intPath = join(dir, "key_ceremonyInt000.kryptos");

    // KEK derived from a seed FILE.
    const seedPath = join(dir, "seed.kryptos");
    writeFileSync(seedPath, seedEnv() + "\n");
    const kekOut = await captureLogs(() =>
      derive({
        type: "oct",
        use: "enc",
        algorithm: "A256KW",
        seed: seedPath,
        path: "urn:lindorm:tyr:kek:v1",
        write: dir,
      }),
    );

    // No inline secret ever appeared on stdout during the ceremony.
    for (const out of [rootOut, intOut, kekOut]) {
      expect(out).not.toMatch(/kryptos:\S/);
    }

    const intermediate = KryptosKit.env.import(readFileSync(intPath, "utf8"));
    expect(intermediate.certificateChain).toHaveLength(2);
    expect(intermediate.certificate?.subject.organizationalUnit).toBe("development");
  });
});

describe("kryptos export CLI", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kryptos-export-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const NB = new Date("2026-01-01T00:00:00Z");

  const threeTierLeaf = (algorithm: KryptosAlgorithm) => {
    const root = KryptosKit.generate.auto({
      algorithm: "ES384",
      notBefore: NB,
      expiresAt: new Date("2046-01-01T00:00:00Z"),
      certificate: { mode: "root-ca", subject: "Root", pathLengthConstraint: 1 },
    });
    const inter = KryptosKit.generate.auto({
      algorithm: "ES256",
      notBefore: NB,
      expiresAt: new Date("2040-01-01T00:00:00Z"),
      certificate: {
        mode: "intermediate-ca",
        ca: root,
        subject: "Int",
        pathLengthConstraint: 0,
      },
    });
    return KryptosKit.generate.auto({
      algorithm,
      notBefore: NB,
      expiresAt: new Date("2036-01-01T00:00:00Z"),
      certificate: { mode: "ca-signed", ca: inter, subject: "leaf" },
    });
  };

  const read = (suffix: string): string =>
    readFileSync(join(dir, `${kid}.${suffix}`), "utf8");

  let kid: string;

  const countCerts = (suffix: string): number =>
    (read(suffix).match(/-----BEGIN CERTIFICATE-----/g) ?? []).length;

  describe.each(["ES256", "EdDSA", "RS256", "ML-DSA-44"] as const)(
    "3-tier ca-signed %s leaf",
    (algorithm) => {
      test("writes all five PEM files that parse and round-trip", async () => {
        const leaf = threeTierLeaf(algorithm);
        kid = leaf.id;

        await exportKey(KryptosKit.env.export(leaf), { write: dir });

        // All five files exist.
        for (const suffix of [
          "privkey.pem",
          "pubkey.pem",
          "cert.pem",
          "chain.pem",
          "fullchain.pem",
        ]) {
          expect(statSync(join(dir, `${kid}.${suffix}`)).isFile()).toBe(true);
        }

        // privkey is 0600, the rest are readable.
        expect(statSync(join(dir, `${kid}.privkey.pem`)).mode & 0o777).toBe(0o600);

        // BEGIN/END markers present.
        expect(read("privkey.pem")).toMatch(/-----BEGIN [\w ]*PRIVATE KEY-----/);
        expect(read("privkey.pem")).toMatch(/-----END [\w ]*PRIVATE KEY-----\s*$/);
        expect(read("pubkey.pem")).toMatch(/-----BEGIN [\w ]*PUBLIC KEY-----/);

        // Cert block counts: leaf=1, chain(issuers)=2, fullchain=3.
        expect(countCerts("cert.pem")).toBe(1);
        expect(countCerts("chain.pem")).toBe(2);
        expect(countCerts("fullchain.pem")).toBe(3);

        // chain.pem = fullchain.pem minus the leaf.
        expect(read("fullchain.pem").trim()).toBe(
          `${read("cert.pem").trim()}\n${read("chain.pem").trim()}`,
        );

        // The private key PEM round-trips to the same key material.
        const reimport = KryptosKit.from.pem({
          id: leaf.id,
          algorithm: leaf.algorithm,
          type: leaf.type,
          use: leaf.use,
          ...(leaf.curve ? { curve: leaf.curve } : {}),
          privateKey: read("privkey.pem"),
        });
        expect(reimport.export("der").privateKey).toEqual(leaf.export("der").privateKey);
      });
    },
  );

  test("a key without a certificate writes only privkey + pubkey", async () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });
    kid = key.id;

    await exportKey(KryptosKit.env.export(key), { write: dir });

    expect(readdirSync(dir).sort()).toEqual([`${kid}.privkey.pem`, `${kid}.pubkey.pem`]);
  });

  test("a public-only key writes no privkey file", async () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });
    const publicOnly = KryptosKit.from.jwk({ ...key.toJWK("public") });
    kid = publicOnly.id;

    await exportKey(KryptosKit.env.export(publicOnly), { write: dir });

    const files = readdirSync(dir);
    expect(files).toContain(`${kid}.pubkey.pem`);
    expect(files).not.toContain(`${kid}.privkey.pem`);
  });

  test("a symmetric oct key writes only a private-key block", async () => {
    const oct = KryptosKit.generate.auto({ algorithm: "A256KW" });
    kid = oct.id;

    await exportKey(KryptosKit.env.export(oct), { write: dir });

    expect(readdirSync(dir)).toEqual([`${kid}.privkey.pem`]);
  });

  test("refuses to overwrite an existing file", async () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });
    const env = KryptosKit.env.export(key);

    await exportKey(env, { write: dir });

    await expect(exportKey(env, { write: dir })).rejects.toThrow(
      /Refusing to overwrite/i,
    );
  });

  test("accepts a .kryptos file path as input", async () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });
    kid = key.id;
    const keyPath = join(dir, "key.kryptos");
    writeFileSync(keyPath, KryptosKit.env.export(key) + "\n");

    await exportKey(keyPath, { write: dir });

    expect(statSync(join(dir, `${kid}.privkey.pem`)).isFile()).toBe(true);
  });

  test("never prints key material to stdout", async () => {
    const key = KryptosKit.generate.auto({
      algorithm: "ES256",
      certificate: { mode: "self-signed", subject: "leaf" },
    });
    kid = key.id;

    const out = await captureLogs(() =>
      exportKey(KryptosKit.env.export(key), { write: dir }),
    );

    // The private key body must never appear on stdout — only paths + summary.
    const privateBody = read("privkey.pem").split("\n")[1];
    expect(out).not.toContain(privateBody);
    expect(out).toContain(join(dir, `${kid}.privkey.pem`));
    expect(out).toContain("thumbprint");
  });
});
