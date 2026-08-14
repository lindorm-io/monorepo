import { B64 } from "@lindorm/b64";
import { describe, expect, test } from "vitest";
import { JweError } from "../../errors/index.js";
import { assembleJweCompact } from "./assemble-jwe-compact.js";
import { encodeJoseHeader } from "./jose-header.js";
import { splitJweCompact } from "./split-jwe-compact.js";

const header = encodeJoseHeader({
  alg: "A256KW",
  enc: "A256GCM",
  kid: "key_test",
  typ: "JWE",
});

/** The reader is driven off what the writer produced — the round trip IS the contract. */
const assemble = (publicEncryptionKey: Buffer | undefined): string =>
  assembleJweCompact({
    header,
    publicEncryptionKey,
    initialisationVector: Buffer.from("iv-bytes", "utf8"),
    content: Buffer.from("ciphertext", "utf8"),
    authTag: Buffer.from("auth-tag", "utf8"),
  });

describe("splitJweCompact", () => {
  test("round-trips what assemble wrote", () => {
    const split = splitJweCompact(assemble(Buffer.from("wrapped-cek", "utf8")));

    expect(B64.toBuffer(split.content, "base64url").toString("utf8")).toBe("ciphertext");
    expect(B64.toBuffer(split.authTag, "base64url").toString("utf8")).toBe("auth-tag");
    expect(B64.toBuffer(split.initialisationVector, "base64url").toString("utf8")).toBe(
      "iv-bytes",
    );
    expect(B64.toBuffer(split.publicEncryptionKey!, "base64url").toString("utf8")).toBe(
      "wrapped-cek",
    );
  });

  test("reports an EMPTY encrypted-key segment as undefined", () => {
    // "the key is absent" and "the key is the empty string" must not be different
    // states downstream — the AES record takes `undefined`.
    expect(splitJweCompact(assemble(undefined)).publicEncryptionKey).toBeUndefined();
  });

  test("decodes the protected header, leaving the other four segments base64url", () => {
    const split = splitJweCompact(assemble(undefined));

    expect(split.header.alg).toBe("A256KW");
    expect(split.header.enc).toBe("A256GCM");
    expect(split.header.typ).toBe("JWE");
  });

  test("refuses anything that is not exactly five segments", () => {
    for (const token of ["a.b.c", "a.b.c.d", "a.b.c.d.e.f", ""]) {
      expect(() => splitJweCompact(token)).toThrow(
        expect.objectContaining({ code: "jwe_invalid_format" }),
      );
    }
  });

  test("the format refusal is a JweError", () => {
    expect(() => splitJweCompact("a.b.c")).toThrow(JweError);
  });
});
