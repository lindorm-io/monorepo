import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { Kryptos, KryptosKit } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ShaKit } from "@lindorm/sha";
import { decode, encode, Tag } from "cbor2";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { type RawLabelMap, inspectToken } from "../__fixtures__/inspect-token.js";
import {
  TEST_X509_CHAIN_B64,
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_PEM,
  TEST_X509_LEAF_PRIVATE_KEY_B64,
  TEST_X509_LEAF_PUBLIC_KEY_B64,
  TEST_X509_ROOT_PEM,
} from "../__fixtures__/x509.js";
import { encodeCbor } from "../internal/cose/cbor.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";
import { encToCoseLabel } from "../internal/cose/enc-labels.js";
import {
  buildEncStructure,
  buildSigStructure,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { Aegis } from "./Aegis.js";
import { SignatureKit } from "./SignatureKit.js";

// The X.509 fixtures are valid from 2026-04-13, so the clock sits inside their
// window and no incidental validity check decides an outcome here.
MockDate.set(new Date("2026-06-01T12:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const KID = "b7c81e42-0000-0000-0000-aegis-cose-cert";

const defaults = {
  notBefore: new Date("2020-01-01T00:00:00.000Z"),
  expiresAt: new Date("2120-01-01T00:00:00.000Z"),
  createdAt: new Date("2020-01-01T00:00:00.000Z"),
  updatedAt: new Date("2020-01-01T00:00:00.000Z"),
  issuer: ISSUER,
  jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
  algorithm: "ES256" as const,
  curve: "P-256" as const,
  type: "EC" as const,
  use: "sig" as const,
  internal: true,
  publish: true,
  privateKey: Buffer.from(TEST_X509_LEAF_PRIVATE_KEY_B64, "base64url"),
  publicKey: Buffer.from(TEST_X509_LEAF_PUBLIC_KEY_B64, "base64url"),
};

const CHAIN = [TEST_X509_LEAF_PEM, TEST_X509_INTERMEDIATE_PEM, TEST_X509_ROOT_PEM];

const certBound = (): Kryptos =>
  new Kryptos({ ...defaults, id: KID, certificateChain: CHAIN });

/** The rotation that lost its chain: same id, same material, no certificates. */
const chainless = (): Kryptos => new Kryptos({ ...defaults, id: KID });

const CLAIMS = { subject: "user-1", expires: "1h", tokenType: "access_token" } as const;

/**
 * A `dir` recipient for the COSE_Encrypt0 rows, declared here rather than taken
 * from `__fixtures__/keys.ts` because the shared keys expire in 2024 and this
 * file's clock sits inside the X.509 fixtures' validity window (2026).
 *
 * ⚠ NO CERTIFICATE, and that is the realistic shape: a `dir` key is symmetric and
 * holds no X.509 chain, so a binding on this wire can only ever arrive from a
 * FOREIGN producer, and can only ever be unprovable.
 */
const ENC_KEY = KryptosKit.from.b64({
  notBefore: new Date("2020-01-01T00:00:00.000Z"),
  expiresAt: new Date("2120-01-01T00:00:00.000Z"),
  createdAt: new Date("2020-01-01T00:00:00.000Z"),
  issuer: ISSUER,
  publish: true,
  id: "c4d5e6f7-0000-0000-0000-aegis-cwe-cert",
  algorithm: "dir",
  privateKey: "0SAdXqYgUS_IPXzub2spRQ2VLJl95iTn3wl4HIRYRZg",
  publicKey: "",
  type: "oct",
  use: "enc",
});

/**
 * THE CERTIFICATE BINDING ON THE COSE WIRE, END TO END.
 *
 * ⭐ THE BYTE ASSERTIONS READ THE TOKEN WITH `inspectToken`, which imports nothing
 * from `src/internal/` or `src/classes/`. A round trip through aegis's own decoder
 * proves only that the package agrees with itself, and this package has already
 * produced a wire-format defect of exactly that shape.
 *
 * The structures the byte assertions read — `x5chain` at label 33, `x5t` at
 * label 34, and the SHA-256 identifier `-16`: RFC 9360 §2, RFC 9054 §3.2.
 */
describe("COSE certificate binding", () => {
  let aegis: Aegis;
  let amphora: IAmphora;
  let logged: Array<string>;

  const build = async (mode?: "strict" | "lax"): Promise<void> => {
    logged = [];
    const logger = createMockLogger((message: string) => {
      logged.push(message);
    });

    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    await amphora.setup();

    aegis = new Aegis({ amphora, logger, ...(mode ? { certBindingMode: mode } : {}) });
    amphora.add(certBound());
  };

  beforeEach(async () => {
    MockDate.set(new Date("2026-06-01T12:00:00.000Z"));
    await build();
  });

  const protectedBucket = (token: string): RawLabelMap =>
    inspectToken(token).protectedHeader as RawLabelMap;

  describe("what the writer puts on the wire", () => {
    test("a cert-bearing key binds the thumbprint by default, as a COSE_CertHash", async () => {
      const { token } = await aegis.mint("default", CLAIMS, { format: "cwt" } as never);

      const hash = protectedBucket(token).get(34) as Array<unknown>;

      expect(hash).toHaveLength(2);
      expect(hash[0]).toBe(-16);
      expect(hash[1]).toBeInstanceOf(Uint8Array);
      expect((hash[1] as Uint8Array).length).toBe(32);

      // The DEFAULT is the thumbprint alone — the chain costs kilobytes per token
      // and travels only when a caller asks for it.
      expect(protectedBucket(token).has(33)).toBe(false);
    });

    /**
     * ⚠ THE CONTENTS, not merely the presence or the shape. A truncated,
     * reversed, PEM-armoured or base64url-mangled chain is still an array of byte
     * strings, and it is one no relying party can build a path from, so a
     * length-and-`instanceof` assertion passes on every one of them. RFC 9360 §2.
     */
    test("chain mode adds the COSE_X509 chain beside the digest", async () => {
      const { token } = await aegis.mint("default", CLAIMS, {
        format: "cwt",
        sign: { bindCertificate: "chain" },
      } as never);

      const chain = protectedBucket(token).get(33);

      // Three certificates, so each rides its own byte string. RFC 9360 §2.
      expect(Array.isArray(chain)).toBe(true);
      for (const cert of chain as Array<unknown>) {
        expect(cert).toBeInstanceOf(Uint8Array);
      }

      // The DER bytes themselves, against the fixture, in order. Base64 is the
      // comparison vocabulary only because that is the spelling the fixture holds
      // (RFC 7515 §4.1.6); the wire carries the raw bytes these encode.
      expect((chain as Array<Uint8Array>).map((cert) => B64.encode(cert))).toEqual(
        TEST_X509_CHAIN_B64,
      );

      expect(protectedBucket(token).has(34)).toBe(true);
    });

    /**
     * ⚠ ONE DIGEST, and it is the "as close as can be" boundary between the wires:
     * a CBOR map cannot carry a duplicate key, so the SHA-1 thumbprint the JOSE
     * twin emits beside `x5t#S256` has no second label to ride under. The JOSE
     * control below is what makes that a statement about COSE rather than about
     * this deployment.
     */
    test("no second digest rides beside it, where the JOSE twin carries one", async () => {
      const cose = await aegis.mint("default", CLAIMS, { format: "cwt" } as never);
      const jose = await aegis.mint("default", CLAIMS, { format: "jwt" } as never);

      const labels = [...(protectedBucket(cose.token) as Map<unknown, unknown>).keys()];
      expect(labels.filter((label) => label === 34)).toHaveLength(1);

      const joseHeader = inspectToken(jose.token).protectedHeader as Dict;
      expect(joseHeader["x5t#S256"]).toBeDefined();
      expect(joseHeader.x5t).toBeDefined();
    });

    test("a binding the issuer switches off emits neither label", async () => {
      const { token } = await aegis.mint("default", CLAIMS, {
        format: "cwt",
        sign: { bindCertificate: "none" },
      } as never);

      expect(protectedBucket(token).has(33)).toBe(false);
      expect(protectedBucket(token).has(34)).toBe(false);
    });
  });

  describe("the round trip", () => {
    test.each(["strict", "lax"] as const)(
      "a token aegis signs verifies under its own binding in %s mode",
      async (mode) => {
        await build(mode);

        const { token } = await aegis.mint("default", CLAIMS, {
          format: "cwt",
          sign: { bindCertificate: "chain" },
        } as never);

        const verified = await aegis.verify(token);

        // The domain header reports the binding in aegis vocabulary, which is what
        // makes the two wires answer one question: the COSE label reached the same
        // field the JOSE parameter does.
        expect(verified.header.certificateThumbprint).toBeDefined();
        expect(verified.header.certificateChain).toHaveLength(CHAIN.length);
      },
    );

    /**
     * ⚠ THE DIGEST COMES BACK IN THE JOSE SPELLING — base64url of the same bytes —
     * so a consumer reading `header.certificateThumbprint` cannot tell which wire
     * carried the token. That is the point of dispatching label 34 into the domain
     * fields rather than reporting the COSE structure.
     */
    test("both wires report the same digest for the same key", async () => {
      const cose = await aegis.mint("default", CLAIMS, { format: "cwt" } as never);
      const jose = await aegis.mint("default", CLAIMS, { format: "jwt" } as never);

      const fromCose = await aegis.verify(cose.token);
      const fromJose = await aegis.verify(jose.token);

      expect(fromCose.header.certificateThumbprint).toBe(
        fromJose.header.certificateThumbprint,
      );
    });
  });

  describe("a binding that cannot be honoured", () => {
    /**
     * ⭐ THE TAMPER. The digest is rewritten inside the PROTECTED bucket and the
     * signature left as it was, so the token must be refused — which is what says
     * the binding is not merely written but SECURED. RFC 9052 §4.4.
     */
    test("a rewritten thumbprint is refused", async () => {
      const { token } = await aegis.mint("default", CLAIMS, { format: "cwt" } as never);

      const outer = decode(Buffer.from(token, "base64url"), {
        preferMap: true,
        rejectDuplicateKeys: true,
      }) as Tag;
      const sign1 = outer.contents as Tag;
      const parts = sign1.contents as Array<unknown>;

      const bucket = decode(parts[0] as Uint8Array, { preferMap: true }) as Map<
        number,
        unknown
      >;
      const [algorithm] = bucket.get(34) as Array<unknown>;
      bucket.set(34, [algorithm, Buffer.alloc(32, 9)]);

      const rewritten = encode(
        new Tag(outer.tag, new Tag(sign1.tag, [encode(bucket), ...parts.slice(1)])),
      );

      // The CODE is asserted, not merely a throw: a bare rejection would also be
      // satisfied by a malformed re-encode, which would prove nothing about the
      // signature covering the binding.
      await expect(
        aegis.verify(Buffer.from(rewritten).toString("base64url")),
      ).rejects.toMatchObject({ code: "cose_signature_invalid" });
    });

    /**
     * The STRANDED case, produced the way a deployment produces it: the key is
     * replaced under its own id by a chain-less twin holding the same material, so
     * the signature still verifies and only the binding check can fail.
     */
    test.each([undefined, "strict"] as const)(
      "a stranded token is refused when the mode is %s",
      async (mode) => {
        await build(mode);

        const { token } = await aegis.mint("default", CLAIMS, { format: "cwt" } as never);

        amphora.add(chainless());

        await expect(aegis.verify(token)).rejects.toMatchObject({
          code: "cert_binding_chain_missing",
        });
      },
    );

    test("a stranded token passes in lax mode, with a warning that names the parameter", async () => {
      await build("lax");

      const { token } = await aegis.mint("default", CLAIMS, { format: "cwt" } as never);

      amphora.add(chainless());

      await expect(aegis.verify(token)).resolves.toBeDefined();

      expect(logged.filter((message) => message.includes("x5t#S256"))).not.toEqual([]);
      expect(logged.filter((message) => message.includes("lax mode"))).not.toEqual([]);
    });
  });

  /**
   * ⭐⭐ A FOREIGN BINDING UNDER SHA-384 / SHA-512.
   *
   * A foreign issuer may bind with SHA-384 (`-43`) or SHA-512 (`-44`).
   * RFC 9360 §2, RFC 9054 §3.2. Neither has a domain header field
   * (`cose-wide-cert-binding.ts`), so the comparison is resolved on the COSE read
   * path against the leaf's own DER.
   *
   * The fixtures are built by signing with the cert-bearing key and REWRITING
   * label 34 — the token is then re-signed with the same key, so the only thing
   * under test is the binding.
   */
  describe("a binding under an algorithm JOSE has no parameter for", () => {
    const rebind = (bytes: Buffer, hashAlg: number, digest: Buffer): Buffer => {
      const outer = decode(bytes, { preferMap: true, rejectDuplicateKeys: true }) as Tag;
      const sign1 = outer.contents as Tag;
      const [protectedBstr, unprotected, payload] = sign1.contents as Array<unknown>;

      const bucket = decode(protectedBstr as Uint8Array, { preferMap: true }) as Map<
        number,
        unknown
      >;
      bucket.set(34, [hashAlg, digest]);

      const rewritten = Buffer.from(encode(bucket));

      // Re-signed over the REWRITTEN protected bucket (RFC 9052 §4.4), so the
      // token is valid and only the binding differs from one aegis would have
      // written.
      const secured = new SignatureKit({ kryptos: certBound(), raw: true }).sign(
        buildSigStructure(rewritten, Buffer.from(payload as Uint8Array)),
      );

      return Buffer.from(
        encode(
          new Tag(
            outer.tag,
            new Tag(sign1.tag, [rewritten, unprotected, payload, secured]),
          ),
        ),
      );
    };

    const leafDer = (): Buffer => certBound().certificate("der")!.chain[0];

    const bound = async (hashAlg: number, digest: Buffer): Promise<string> => {
      const { token } = await aegis.mint("default", CLAIMS, { format: "cwt" } as never);
      return rebind(Buffer.from(token, "base64url"), hashAlg, digest).toString(
        "base64url",
      );
    };

    /**
     * ⚠⚠ THE SECOND HALF IS THE ASSERTION, and a "verifies" row without it proves
     * only that the token was NOT REFUSED — which is exactly the silent drop a
     * resolver returning `undefined` produces, and the behaviour the comparison
     * exists to end. Neutering `resolveWideCertBinding` to return `undefined`
     * leaves the first `resolves` green.
     *
     * So the same token is verified twice: once against the cert-bearing key,
     * where the digest matches, and once against the chain-less twin, where a LIVE
     * resolver has a binding to report and no certificate to prove it with. Only a
     * resolver that actually read label 34 can produce the second verdict.
     */
    test.each([
      [-43, "SHA-384", (der: Buffer) => ShaKit.S384(der)],
      [-44, "SHA-512", (der: Buffer) => ShaKit.S512(der)],
    ] as const)(
      "verifies a %s (%s) binding that matches our leaf, and only because it read it",
      async (label, _name, digest) => {
        const token = await bound(label, Buffer.from(digest(leafDer()), "base64url"));

        await expect(aegis.verify(token)).resolves.toBeDefined();

        // The chain is lost AFTER signing — same id, same material, so the
        // signature still verifies and only the binding check can fail.
        amphora.add(chainless());

        await expect(aegis.verify(token)).rejects.toMatchObject({
          code: "cert_binding_chain_missing",
        });
      },
    );

    // ⚠ BOTH MODES. `lax` widens what may go UNPROVEN, never what may be WRONG.
    test.each([
      [-43, "strict"],
      [-43, "lax"],
      [-44, "strict"],
      [-44, "lax"],
    ] as const)(
      "hard-fails a %s binding that does not match, in %s mode",
      async (label, mode) => {
        await build(mode);

        const token = await bound(label, Buffer.alloc(label === -43 ? 48 : 64, 9));

        await expect(aegis.verify(token)).rejects.toMatchObject({
          code: "cert_binding_thumbprint_mismatch",
        });
      },
    );

    /**
     * ⚠ AN ALGORITHM AEGIS DOES NOT IMPLEMENT STILL DROPS: `ShaAlgorithm` offers
     * no method for SHA-512/256 (`-17`, RFC 9054 §3.2), so there is nothing to
     * compare and nothing to decide — in either mode.
     */
    test.each(["strict", "lax"] as const)(
      "drops an algorithm it does not implement, in %s mode",
      async (mode) => {
        await build(mode);

        const token = await bound(-17, Buffer.alloc(32, 9));

        await expect(aegis.verify(token)).resolves.toBeDefined();
      },
    );

    // The unprovable arm: the binding is asserted and the key has lost its chain,
    // which is the same state an absent chain puts a SHA-256 binding in.
    test("refuses a strong binding the verifying key has no chain to confirm", async () => {
      const token = await bound(-44, Buffer.from(ShaKit.S512(leafDer()), "base64url"));

      amphora.add(chainless());

      await expect(aegis.verify(token)).rejects.toMatchObject({
        code: "cert_binding_chain_missing",
      });
    });

    /**
     * ⚠ THE LAX TWIN, and the WARNING is the whole assertion: lax accepts what it
     * cannot prove, so the log line is the only compensating control a deployment
     * has. A row asserting the pass alone would be satisfied by a resolver that
     * never ran.
     */
    test("passes an unprovable strong binding in lax mode, naming the algorithm", async () => {
      await build("lax");

      const token = await bound(-44, Buffer.from(ShaKit.S512(leafDer()), "base64url"));

      amphora.add(chainless());

      await expect(aegis.verify(token)).resolves.toBeDefined();

      expect(logged.filter((message) => message.includes("SHA-512"))).not.toEqual([]);
      expect(logged.filter((message) => message.includes("lax mode"))).not.toEqual([]);
    });
  });

  /**
   * ⭐ THE COSE_Encrypt0 PATH, which is the one that picks its bucket BY HAND.
   *
   * `CweKit.decrypt` decodes the protected bucket itself (it needs the AEAD's
   * algorithm before it can decrypt) and passes that map to the resolver. Every
   * other COSE read gets `protectedMap` handed to it by `verifyCoseStructure`, so
   * this is the only site where wiring the resolver to the UNPROTECTED bucket
   * would be a silent change: `CweKit.encrypt` feeds the protected bucket to
   * `buildEncStructure` as the AEAD's AAD, and the unprotected one is covered by
   * nothing. RFC 9052 §5.3.
   *
   * The fixture is a FOREIGN COSE_Encrypt0 built here rather than by aegis: a
   * `dir` recipient key is symmetric and carries no X.509 certificate, so no aegis
   * writer would ever emit a binding on this wire.
   */
  describe("a COSE_Encrypt0 that binds a certificate", () => {
    // Raw RFC 9052 §3.1 labels, written as a foreign producer would rather than
    // resolved through aegis's own registry — the same reason `inspect-token.ts`
    // imports nothing from `internal/`.
    const LABEL = { alg: 1, cty: 3, kid: 4, iv: 5, typ: 16, x5t: 34 } as const;

    const foreignCwe = (bucket: "protected" | "unprotected"): string => {
      const kryptos = ENC_KEY;
      const encryption = kryptos.encryption ?? "A256GCM";
      const plaintext = Buffer.from(JSON.stringify({ hello: "world" }), "utf8");

      // A SHA-512 COSE_CertHash this key cannot possibly satisfy — it holds no
      // certificate at all, so the honest verdict is UNPROVABLE, not mismatched.
      const certHash = [-44, Buffer.alloc(64, 9)];

      const protectedMap = new Map<CoseLabel, unknown>([
        [LABEL.alg, encToCoseLabel(encryption)],
        [LABEL.typ, "application/cwe"],
        [LABEL.cty, "application/json"],
      ]);
      if (bucket === "protected") protectedMap.set(LABEL.x5t, certHash);

      const protectedBstr = encodeProtectedHeader(protectedMap);

      const { ciphertext, iv, tag } = new AesKit({
        kryptos,
        defaultEncryption: encryption,
      }).encryptContent(plaintext, { aad: buildEncStructure(protectedBstr) });

      const unprotectedMap = new Map<CoseLabel, unknown>([
        // A foreign producer writes the `kid` as utf-8 bytes rather than a text
        // string. RFC 9052 §3.1.
        [LABEL.kid, Buffer.from(kryptos.id, "utf8")],
        [LABEL.iv, iv],
      ]);
      if (bucket === "unprotected") unprotectedMap.set(LABEL.x5t, certHash);

      return encodeCbor(
        new Tag(16, [protectedBstr, unprotectedMap, Buffer.concat([ciphertext, tag])]),
      ).toString("base64url");
    };

    beforeEach(() => {
      amphora.add(ENC_KEY);
    });

    test("refuses a binding in the PROTECTED bucket that it cannot prove", async () => {
      await expect(aegis.cwe.decrypt(foreignCwe("protected"))).rejects.toMatchObject({
        code: "cert_binding_chain_missing",
      });
    });

    /**
     * ⚠ THE BUCKET IS THE ASSERTION. The identical `COSE_CertHash` in the
     * UNPROTECTED bucket is IGNORED — it is covered by no AEAD, so any holder of
     * the token could add or rewrite it, and acting on one would let a bystander
     * decide whether a token is refused. Without this row, wiring the resolver to
     * the wrong bucket passes every other test in this file.
     */
    test("ignores the identical binding in the UNPROTECTED bucket", async () => {
      await expect(aegis.cwe.decrypt(foreignCwe("unprotected"))).resolves.toMatchObject({
        payload: { hello: "world" },
      });
    });
  });
});
