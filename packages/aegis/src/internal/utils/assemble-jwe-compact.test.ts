import { describe, expect, test } from "vitest";
import { JweError } from "../../errors/index.js";
import { buildJoseHeader } from "../header/build-jose-header.js";
import { KIT_CAPABILITIES } from "../registry/kit-capabilities.js";
import { assembleJweCompact } from "./assemble-jwe-compact.js";
import { encodeJoseHeader } from "./jose-header.js";

const header = encodeJoseHeader(
  buildJoseHeader({
    reserved: KIT_CAPABILITIES.jwe.reserved,
    defaults: {},
    header: undefined,
    custom: undefined,
    derived: { alg: "A256KW", enc: "A256GCM", kid: "key_test", typ: "JWE" },
    cert: undefined,
    format: "jwe",
    error: JweError,
  }),
);

const assemble = (publicEncryptionKey: Buffer | undefined): string =>
  assembleJweCompact({
    header,
    publicEncryptionKey,
    initialisationVector: Buffer.from("iv-bytes", "utf8"),
    content: Buffer.from("ciphertext", "utf8"),
    authTag: Buffer.from("auth-tag", "utf8"),
  });

describe("assembleJweCompact", () => {
  test("joins five dot-separated base64url segments", () => {
    const token = assemble(Buffer.from("wrapped-cek", "utf8"));

    expect(token.split(".")).toHaveLength(5);
    expect(token.split(".")[0]).toBe(header);
  });

  test("a key management with no encrypted key leaves the segment EMPTY", () => {
    // RFC 7516 §7.1 — `dir` and ECDH-ES direct produce no encrypted key, but the
    // five dots are the grammar, so the segment is empty rather than dropped.
    const parts = assemble(undefined).split(".");

    expect(parts).toHaveLength(5);
    expect(parts[1]).toBe("");
  });

  test("every segment is base64url, never standard base64", () => {
    const parts = assemble(Buffer.from([0xfb, 0xff, 0xbe])).split(".");

    expect(parts.join("")).not.toMatch(/[+/=]/);
  });
});
