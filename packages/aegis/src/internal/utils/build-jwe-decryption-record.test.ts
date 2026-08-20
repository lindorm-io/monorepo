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

const header = (overrides: Partial<DomainTokenHeader> = {}): DomainTokenHeader =>
  ({
    algorithm: "A256KW",
    critical: [],
    encryption: "A256GCM",
    keyId: undefined,
    pbkdfIterations: undefined,
    pbkdfSalt: undefined,
    initialisationVector: undefined,
    publicEncryptionJwk: undefined,
    publicEncryptionTag: undefined,
    partyProducer: undefined,
    partyRecipient: undefined,
    ...overrides,
  }) as DomainTokenHeader;

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

  test("decodes the HEADER parameters — the PBKDF pair and the public material", () => {
    const record = build({
      header: header({
        pbkdfIterations: 4096,
        pbkdfSalt: b64u("salt"),
        initialisationVector: b64u("kw-iv"),
        publicEncryptionTag: b64u("kw-tag"),
      }),
    });

    expect(record.pbkdfIterations).toBe(4096);
    expect(record.pbkdfSalt?.toString("utf8")).toBe("salt");
    expect(record.publicEncryptionIv?.toString("utf8")).toBe("kw-iv");
    expect(record.publicEncryptionTag?.toString("utf8")).toBe("kw-tag");
  });

  test("an absent header parameter stays undefined rather than an empty buffer", () => {
    const record = build();

    expect(record.pbkdfSalt).toBeUndefined();
    expect(record.publicEncryptionIv).toBeUndefined();
    expect(record.publicEncryptionTag).toBeUndefined();
    expect(record.pbkdfIterations).toBeUndefined();
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
