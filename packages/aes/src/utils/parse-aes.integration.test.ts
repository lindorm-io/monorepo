import { KryptosKit } from "@lindorm/kryptos";
import { AesKit } from "../classes/AesKit.js";
import { parseAes } from "./parse-aes.js";
import type { ParsedAesDecryptionRecord } from "../types/index.js";
import { describe, expect, test } from "vitest";

describe("parseAes (integration — strict return type)", () => {
  const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
  const kit = new AesKit({ kryptos, encryption: "A128GCM" });

  test("tokenised string input produces ParsedAesDecryptionRecord with populated keyId", () => {
    const cipher = kit.encrypt("payload", "tokenised");

    const parsed: ParsedAesDecryptionRecord = parseAes(cipher);

    // Compile-time: keyId is `string`, not `string | undefined`. If parseAes's
    // return type were widened back to loose AesDecryptionRecord, this direct
    // assignment would fail typecheck.
    const keyId: string = parsed.keyId;

    expect(keyId).toEqual(kryptos.id);
  });

  test("encoded string input produces ParsedAesDecryptionRecord with populated keyId", () => {
    const cipher = kit.encrypt("payload", "encoded");

    const parsed: ParsedAesDecryptionRecord = parseAes(cipher);
    const keyId: string = parsed.keyId;

    expect(keyId).toEqual(kryptos.id);
  });

  test("serialised object input produces ParsedAesDecryptionRecord with populated keyId", () => {
    const cipher = kit.encrypt("payload", "serialised");

    const parsed: ParsedAesDecryptionRecord = parseAes(cipher);
    const keyId: string = parsed.keyId;

    expect(keyId).toEqual(kryptos.id);
  });
});
