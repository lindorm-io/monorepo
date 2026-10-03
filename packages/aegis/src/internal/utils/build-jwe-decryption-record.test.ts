import { B64 } from "@lindorm/b64";
import { describe, expect, test } from "vitest";
import type { DomainTokenHeader } from "../../types/index.js";
import { buildJweDecryptionRecord } from "./build-jwe-decryption-record.js";
import type { JweCompactSegments } from "./split-jwe-compact.js";

const b64u = (value: string): string =>
  B64.encode(Buffer.from(value, "utf8"), "base64url");

const segments = (overrides: Partial<JweCompactSegments> = {}): JweCompactSegments => ({
  header: { alg: "A256KW", enc: "A256GCM" } as JweCompactSegments["header"],
  custom: {},
  publicEncryptionKey: b64u("wrapped-cek"),
  initialisationVector: b64u("iv-bytes"),
  content: b64u("ciphertext"),
  authTag: b64u("auth-tag"),
  ...overrides,
});

const header = (overrides: Partial<DomainTokenHeader> = {}): DomainTokenHeader => ({
  algorithm: "A256KW",
  critical: [],
  encryption: "A256GCM",
  ...overrides,
});

const build = (
  overrides: Partial<Parameters<typeof buildJweDecryptionRecord>[0]> = {},
): ReturnType<typeof buildJweDecryptionRecord> =>
  buildJweDecryptionRecord({
    segments: segments(),
    header: header(),
    encryption: "A256GCM",
    apu: undefined,
    apv: undefined,
    keyId: "key_configured",
    ...overrides,
  });

describe("buildJweDecryptionRecord", () => {
  test("decodes the TOKEN SEGMENTS — ciphertext, iv and auth tag", () => {
    const record = build();

    expect(record.content.toString("utf8")).toBe("ciphertext");
    expect(record.initialisationVector.toString("utf8")).toBe("iv-bytes");
    expect(record.authTag.toString("utf8")).toBe("auth-tag");
    expect(record.publicEncryptionKey?.toString("utf8")).toBe("wrapped-cek");
  });

  test("reports an ABSENT encrypted key as undefined", () => {
    // `dir` and ECDH-ES direct carry none; the AES layer takes `undefined`, not an
    // empty buffer.
    expect(
      build({ segments: segments({ publicEncryptionKey: undefined }) })
        .publicEncryptionKey,
    ).toBeUndefined();
  });

  const KEY_MANAGEMENT_BYTES = {
    pbkdfIterations: 4096,
    pbkdfSalt: b64u("salt"),
    initialisationVector: b64u("kw-iv"),
    publicEncryptionTag: b64u("kw-tag"),
  };

  test.each([
    ["A256GCMKW", "the key-wrap iv and tag"],
    ["PBES2-HS512+A256KW", "the PBKDF salt"],
    ["A256KW", "none of them"],
  ])("decodes, under %s, %s", (algorithm) => {
    const record = build({
      header: header({ algorithm: algorithm as never, ...KEY_MANAGEMENT_BYTES }),
    });

    expect({
      pbkdfIterations: record.pbkdfIterations,
      pbkdfSalt: record.pbkdfSalt?.toString("utf8"),
      publicEncryptionIv: record.publicEncryptionIv?.toString("utf8"),
      publicEncryptionTag: record.publicEncryptionTag?.toString("utf8"),
    }).toMatchSnapshot();
  });

  test("an absent p2c reports no PBKDF iteration count", () => {
    expect(build().pbkdfIterations).toBeUndefined();
  });

  test("the header's kid wins; the configured key's id is the fallback", () => {
    expect(build().keyId).toBe("key_configured");
    expect(build({ header: header({ keyId: "key_from_token" }) }).keyId).toBe(
      "key_from_token",
    );
  });

  test("the content type is pinned to octet-stream", () => {
    // The AES layer only ever sees OPAQUE bytes here; the JOSE `cty` — not the AES
    // one — drives reconstruction, and only after the AEAD has verified.
    expect(build().contentType).toBe("application/octet-stream");
  });

  test("carries the ALREADY-GATED apu/apv verbatim", () => {
    const apu = Buffer.from("producer", "utf8");
    const record = build({ apu, apv: undefined });

    expect(record.apu).toBe(apu);
    expect(record.apv).toBeUndefined();
  });

  test("the encryption is the KIT's, and the algorithm the header's", () => {
    const record = build({ header: header({ algorithm: "ECDH-ES+A256KW" }) });

    expect(record.algorithm).toBe("ECDH-ES+A256KW");
    expect(record.encryption).toBe("A256GCM");
    expect(record.version).toBe("1.0");
  });
});
