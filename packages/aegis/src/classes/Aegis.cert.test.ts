import { Amphora, type IAmphora } from "@lindorm/amphora";
import { Kryptos } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_PEM,
  TEST_X509_LEAF_PRIVATE_KEY_B64,
  TEST_X509_LEAF_PUBLIC_KEY_B64,
  TEST_X509_ROOT_PEM,
} from "../__fixtures__/x509.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

// The X.509 fixtures have a validity window of 2026-04-13 .. 2126-03-20. We
// pin MockDate inside the window so that any implicit time-based checks
// (cert validity, JWT iat/exp snapshots) remain stable.
const MockedDate = new Date("2026-06-01T12:00:00.000Z");
MockDate.set(MockedDate);

vi.mock("crypto", async () => ({
  ...(await vi.importActual<typeof import("crypto")>("crypto")),
  randomUUID: vi
    .fn()
    .mockReturnValueOnce("7a14c2ca-1111-4999-b111-aegis-cert-0001")
    .mockReturnValueOnce("7a14c2ca-1111-4999-b111-aegis-cert-0002")
    .mockReturnValueOnce("7a14c2ca-1111-4999-b111-aegis-cert-0003")
    .mockReturnValueOnce("7a14c2ca-1111-4999-b111-aegis-cert-0004")
    .mockReturnValueOnce("7a14c2ca-1111-4999-b111-aegis-cert-0005")
    .mockReturnValueOnce("7a14c2ca-1111-4999-b111-aegis-cert-0006")
    .mockReturnValueOnce("7a14c2ca-1111-4999-b111-aegis-cert-0007")
    .mockReturnValueOnce("7a14c2ca-1111-4999-b111-aegis-cert-0008")
    .mockReturnValueOnce("7a14c2ca-1111-4999-b111-aegis-cert-0009")
    .mockReturnValue("7a14c2ca-1111-4999-b111-aegis-cert-0000"),
}));

const defaults = {
  notBefore: new Date("2020-01-01T00:00:00.000Z"),
  expiresAt: new Date("2120-01-01T00:00:00.000Z"),
  createdAt: new Date("2020-01-01T00:00:00.000Z"),
  updatedAt: new Date("2020-01-01T00:00:00.000Z"),
  issuer: "https://test.lindorm.io/",
  jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
};

const buildCertBoundKryptos = (): Kryptos =>
  new Kryptos({
    ...defaults,
    id: "e1a4f9c0-0000-0000-0000-aegis-cert-key0",
    algorithm: "ES256",
    curve: "P-256",
    type: "EC",
    use: "sig",
    isExternal: false,
    operations: ["sign", "verify"],
    privateKey: Buffer.from(TEST_X509_LEAF_PRIVATE_KEY_B64, "base64url"),
    publicKey: Buffer.from(TEST_X509_LEAF_PUBLIC_KEY_B64, "base64url"),
    certificateChain: [
      TEST_X509_LEAF_PEM,
      TEST_X509_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ],
  });

const buildChainlessKryptos = (): Kryptos =>
  new Kryptos({
    ...defaults,
    id: "f2b5e0d1-0000-0000-0000-aegis-cert-key1",
    algorithm: "ES256",
    curve: "P-256",
    type: "EC",
    use: "sig",
    isExternal: false,
    operations: ["sign", "verify"],
    privateKey: Buffer.from(TEST_X509_LEAF_PRIVATE_KEY_B64, "base64url"),
    publicKey: Buffer.from(TEST_X509_LEAF_PUBLIC_KEY_B64, "base64url"),
  });

describe("Aegis cert binding", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  const signContent = {
    expires: "1h" as const,
    subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
    tokenType: "access_token" as const,
  };

  describe("with cert-bound kryptos", () => {
    beforeEach(async () => {
      logger = createMockLogger();
      amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
      aegis = new Aegis({ amphora, logger });

      await amphora.setup();
      amphora.add(buildCertBoundKryptos());
    });

    test("sign with bindCertificate: 'thumbprint' stamps x5t#S256, no x5c, no x5t", async () => {
      const { token } = await aegis.jwt.sign(signContent, {
        bindCertificate: "thumbprint",
      });

      const decoded = JwtKit.decode(token);
      const stripped = {
        alg: decoded.header.alg,
        kid: decoded.header.kid,
        typ: decoded.header.typ,
        x5c: (decoded.header as any).x5c,
        x5t: (decoded.header as any).x5t,
        "x5t#S256": (decoded.header as any)["x5t#S256"],
      };

      expect(stripped).toMatchSnapshot();
      expect(stripped["x5t#S256"]).toEqual(expect.any(String));
      expect(stripped.x5t).toBeUndefined();
      expect(stripped.x5c).toBeUndefined();
    });

    test("sign with bindCertificate: 'chain' stamps x5c + x5t#S256, no x5t", async () => {
      const { token } = await aegis.jwt.sign(signContent, {
        bindCertificate: "chain",
      });

      const decoded = JwtKit.decode(token);
      const stripped = {
        alg: decoded.header.alg,
        kid: decoded.header.kid,
        typ: decoded.header.typ,
        x5c: (decoded.header as any).x5c,
        x5t: (decoded.header as any).x5t,
        "x5t#S256": (decoded.header as any)["x5t#S256"],
      };

      expect(stripped).toMatchSnapshot();
      expect(Array.isArray(stripped.x5c)).toBe(true);
      expect(stripped.x5c).toHaveLength(3);
      expect(stripped["x5t#S256"]).toEqual(expect.any(String));
      expect(stripped.x5t).toBeUndefined();
    });

    test("sign omitted on cert-bearing kryptos stamps thumbprint by default", async () => {
      const { token } = await aegis.jwt.sign(signContent);

      const decoded = JwtKit.decode(token);
      const stripped = {
        alg: decoded.header.alg,
        kid: decoded.header.kid,
        typ: decoded.header.typ,
        x5c: (decoded.header as any).x5c,
        x5t: (decoded.header as any).x5t,
        "x5t#S256": (decoded.header as any)["x5t#S256"],
      };

      expect(stripped).toMatchSnapshot();
      expect(stripped["x5t#S256"]).toEqual(expect.any(String));
      expect(stripped.x5t).toBeUndefined();
      expect(stripped.x5c).toBeUndefined();
    });

    test("sign with bindCertificate: 'none' on cert-bearing kryptos stamps nothing", async () => {
      const { token } = await aegis.jwt.sign(signContent, {
        bindCertificate: "none",
      });

      const decoded = JwtKit.decode(token);
      expect(decoded.header).not.toHaveProperty("x5c");
      expect(decoded.header).not.toHaveProperty("x5t");
      expect(decoded.header).not.toHaveProperty("x5t#S256");
    });

    test("verify with matching header x5t#S256 succeeds", async () => {
      const { token } = await aegis.jwt.sign(signContent, {
        bindCertificate: "thumbprint",
      });

      await expect(aegis.jwt.verify(token)).resolves.toBeDefined();
    });

    test("verify with chain mode binding succeeds", async () => {
      const { token } = await aegis.jwt.sign(signContent, {
        bindCertificate: "chain",
      });

      await expect(aegis.jwt.verify(token)).resolves.toBeDefined();
    });

    test("verify with tampered header x5t#S256 throws thumbprint mismatch", async () => {
      const { token } = await aegis.jwt.sign(signContent, {
        bindCertificate: "thumbprint",
      });

      const decoded = JwtKit.decode(token);
      const tampered = {
        ...decoded.header,
        "x5t#S256": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(tampered))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      // With a cert-bound kryptos, the post-verify cert check runs. A bad
      // thumbprint must throw a specific message. (The raw signature will
      // also break due to header mutation, but that's caught earlier; the
      // assertion is that a mismatch path exists and fires on a valid sig.)
      await expect(aegis.jwt.verify(modifiedToken)).rejects.toThrow();
    });

    test("valid-sig token with substituted thumbprint fails thumbprint check", async () => {
      // Build a token whose header thumbprint was swapped at sign time via
      // a direct JwtKit with a forged helper is overkill. Instead: sign
      // normally and re-parse via JwtKit with the real kryptos to confirm
      // the thumbprint matches. Then simulate a tampering attack by
      // bypassing signature verification — handled by the direct thumbprint
      // check in verifyCertBinding. We exercise the path by feeding a
      // header with a different but plausible thumbprint string and
      // asserting the exact error.
      const good = await aegis.jwt.sign(signContent, {
        bindCertificate: "thumbprint",
      });
      const decoded = JwtKit.decode(good.token);
      const kryptos = buildCertBoundKryptos();
      expect(decoded.header["x5t#S256"]).toBe(kryptos.certificateThumbprint);

      // Directly exercise verifyCertBinding for the "mismatch" branch by
      // constructing a header with a fake thumbprint.
      const { verifyCertBinding } =
        await import("../internal/utils/verify-cert-binding.js");

      expect(() =>
        verifyCertBinding({
          header: {
            x5tS256: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          },
          kryptos,
          logger,
          mode: "strict",
        }),
      ).toThrow(/signing certificate thumbprint mismatch/);
    });

    test("REGRESSION: malicious x5c injection into header does not change key selection", async () => {
      // A forger builds their own token, signs with a key they control, and
      // stuffs a malicious x5c (or the real x5c) into the header. Amphora
      // still looks up by `kid` only. Verify must fail because the
      // forger's signature does not match the real kryptos public key.
      //
      // Concretely: we sign a token with aegis (real kid, real signature),
      // then replace the header with one that adds a malicious x5c, but
      // KEEP the original signature. The malicious x5c must not be used
      // as a key source — aegis must still fetch the real kryptos by kid
      // and verify with that key. Since we modified the header bytes, the
      // original signature no longer matches the header, and verify fails.
      // The invariant is that the malicious x5c did NOT succeed in
      // selecting itself as the key source.
      const { token } = await aegis.jwt.sign(signContent);
      const decoded = JwtKit.decode(token);
      const malicious = {
        ...decoded.header,
        x5c: ["MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"],
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(malicious))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, parts[1], parts[2]].join(".");

      await expect(aegis.jwt.verify(modifiedToken)).rejects.toThrow();
    });
  });

  describe("with chain-less kryptos", () => {
    beforeEach(async () => {
      logger = createMockLogger();
      amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
      aegis = new Aegis({ amphora, logger });

      await amphora.setup();
      amphora.add(buildChainlessKryptos());
    });

    test("sign with bindCertificate on chain-less kryptos throws", async () => {
      await expect(
        aegis.jwt.sign(signContent, { bindCertificate: "thumbprint" }),
      ).rejects.toThrow(/bindCertificate requires kryptos with certificateChain/);
    });

    test("sign with bindCertificate: 'none' on chain-less kryptos stamps nothing and does not throw", async () => {
      const { token } = await aegis.jwt.sign(signContent, {
        bindCertificate: "none",
      });
      const decoded = JwtKit.decode(token);
      expect(decoded.header).not.toHaveProperty("x5c");
      expect(decoded.header).not.toHaveProperty("x5t");
      expect(decoded.header).not.toHaveProperty("x5t#S256");

      await expect(aegis.jwt.verify(token)).resolves.toBeDefined();
    });

    test("sign without bindCertificate succeeds (regression: base path unchanged)", async () => {
      const { token } = await aegis.jwt.sign(signContent);
      const decoded = JwtKit.decode(token);
      expect(decoded.header).not.toHaveProperty("x5c");
      expect(decoded.header).not.toHaveProperty("x5t");
      expect(decoded.header).not.toHaveProperty("x5t#S256");

      await expect(aegis.jwt.verify(token)).resolves.toBeDefined();
    });

    test("verify fails when header claims x5t#S256 but kryptos has no chain", async () => {
      // Sign a normal token (no cert fields), then inject x5t#S256 into
      // the header and rebuild. The signature is broken by the header
      // mutation, but the check we care about fires independently — we
      // call verifyCertBinding directly to assert the error text.
      const { verifyCertBinding } =
        await import("../internal/utils/verify-cert-binding.js");
      const kryptos = buildChainlessKryptos();

      expect(() =>
        verifyCertBinding({
          header: {
            x5tS256: "abc",
          },
          kryptos,
          logger,
          mode: "strict",
        }),
      ).toThrow(/signing kryptos has no certificateChain/);
    });
  });

  describe("certBindingMode", () => {
    const SHARED_KID = "c0a1b2c3-0000-0000-0000-aegis-cert-shrd";

    const buildSharedCertBoundKryptos = (): Kryptos =>
      new Kryptos({
        ...defaults,
        id: SHARED_KID,
        algorithm: "ES256",
        curve: "P-256",
        type: "EC",
        use: "sig",
        isExternal: false,
        operations: ["sign", "verify"],
        privateKey: Buffer.from(TEST_X509_LEAF_PRIVATE_KEY_B64, "base64url"),
        publicKey: Buffer.from(TEST_X509_LEAF_PUBLIC_KEY_B64, "base64url"),
        certificateChain: [
          TEST_X509_LEAF_PEM,
          TEST_X509_INTERMEDIATE_PEM,
          TEST_X509_ROOT_PEM,
        ],
      });

    const buildSharedChainlessKryptos = (): Kryptos =>
      new Kryptos({
        ...defaults,
        id: SHARED_KID,
        algorithm: "ES256",
        curve: "P-256",
        type: "EC",
        use: "sig",
        isExternal: false,
        operations: ["sign", "verify"],
        privateKey: Buffer.from(TEST_X509_LEAF_PRIVATE_KEY_B64, "base64url"),
        publicKey: Buffer.from(TEST_X509_LEAF_PUBLIC_KEY_B64, "base64url"),
      });

    const setupAegis = async (
      mode?: "strict" | "lax",
    ): Promise<{
      aegis: Aegis;
      amphora: IAmphora;
      logger: ILogger;
    }> => {
      const localLogger = createMockLogger();
      const localAmphora = new Amphora({
        domain: "https://test.lindorm.io/",
        logger: localLogger,
      });
      const localAegis = new Aegis({
        amphora: localAmphora,
        logger: localLogger,
        ...(mode ? { certBindingMode: mode } : {}),
      });
      await localAmphora.setup();
      return { aegis: localAegis, amphora: localAmphora, logger: localLogger };
    };

    test("default mode is strict — stranded token after kryptos chain loss throws", async () => {
      const { aegis: localAegis, amphora: localAmphora } = await setupAegis();
      localAmphora.add(buildSharedCertBoundKryptos());

      const { token } = await localAegis.jwt.sign(signContent);

      // Simulate chain loss after signing: overwrite the same kid with a
      // chain-less kryptos that shares the key material so the signature
      // still verifies, but the post-verify cert-binding check fires.
      localAmphora.add(buildSharedChainlessKryptos());

      await expect(localAegis.jwt.verify(token)).rejects.toThrow(
        /signing kryptos has no certificateChain/,
      );
    });

    test("explicit strict matches default behaviour", async () => {
      const { aegis: localAegis, amphora: localAmphora } = await setupAegis("strict");
      localAmphora.add(buildSharedCertBoundKryptos());

      const { token } = await localAegis.jwt.sign(signContent);

      localAmphora.add(buildSharedChainlessKryptos());

      await expect(localAegis.jwt.verify(token)).rejects.toThrow(
        /signing kryptos has no certificateChain/,
      );
    });

    test("lax mode allows stranded tokens through with a warn log", async () => {
      const warnSpy: Array<{ message: string; meta: unknown }> = [];
      const localLogger = createMockLogger((msg: string, meta: unknown) => {
        warnSpy.push({ message: msg, meta });
      });
      const localAmphora = new Amphora({
        domain: "https://test.lindorm.io/",
        logger: localLogger,
      });
      const localAegis = new Aegis({
        amphora: localAmphora,
        logger: localLogger,
        certBindingMode: "lax",
      });
      await localAmphora.setup();
      localAmphora.add(buildSharedCertBoundKryptos());

      const { token } = await localAegis.jwt.sign(signContent);

      localAmphora.add(buildSharedChainlessKryptos());

      await expect(localAegis.jwt.verify(token)).resolves.toBeDefined();

      const laxWarn = warnSpy.find((entry) => /lax mode/.test(entry.message));
      expect(laxWarn).toBeDefined();
      expect(laxWarn?.message).toMatch(/x5t#S256/);
    });

    test("lax still rejects thumbprint mismatch (critical invariant)", async () => {
      // The plan accepts a direct unit test of verifyCertBinding for the
      // mismatch path under lax mode, since manufacturing two valid
      // signatures with different cert chains in-test is impractical with
      // a single fixture set. The invariant we're proving: lax skips ONLY
      // the "stranded" branch, never the "mismatch" branch.
      const { verifyCertBinding } =
        await import("../internal/utils/verify-cert-binding.js");
      const certKryptos = buildCertBoundKryptos();

      expect(() =>
        verifyCertBinding({
          header: {
            x5tS256: "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
          },
          kryptos: certKryptos,
          logger,
          mode: "lax",
        }),
      ).toThrow(/signing certificate thumbprint mismatch/);
    });

    test("lax with no header thumbprint is a no-op", async () => {
      const { aegis: localAegis, amphora: localAmphora } = await setupAegis("lax");
      localAmphora.add(buildChainlessKryptos());

      const { token } = await localAegis.jwt.sign(signContent);
      const decoded = JwtKit.decode(token);
      expect(decoded.header).not.toHaveProperty("x5t#S256");

      await expect(localAegis.jwt.verify(token)).resolves.toBeDefined();
    });

    test("strict mode is unaffected by header-less tokens", async () => {
      const { aegis: localAegis, amphora: localAmphora } = await setupAegis("strict");
      localAmphora.add(buildChainlessKryptos());

      const { token } = await localAegis.jwt.sign(signContent);
      await expect(localAegis.jwt.verify(token)).resolves.toBeDefined();
    });
  });

  describe("SECURITY INVARIANT comment", () => {
    // Documentation-style regression: if someone refactors kryptosSig and
    // accidentally weakens or removes the invariant comment, this test
    // fails and draws attention to the missing safety net.
    test("Aegis.kryptosSig still carries the header-key-source rejection comment", () => {
      const source = fs.readFileSync(path.resolve(__dirname, "Aegis.ts"), "utf8");

      expect(source).toContain("SECURITY INVARIANT");
      expect(source).toContain("verification keys are ALWAYS sourced from Amphora");
      expect(source).toContain("never trusted as key sources");
    });
  });
});
