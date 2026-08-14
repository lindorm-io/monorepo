import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { TEST_OCT_KEY_ENC } from "../../__fixtures__/keys.js";
import { CweKit } from "../../classes/CweKit.js";
import { coseEncryptDomainHeader } from "./cose-encrypt-domain-header.js";

/**
 * The keyless COSE_Encrypt0 header read, which is what `aegis.decrypt` reports
 * for a `cwe` before it has the key.
 *
 * ⚠ It replaced a hand-written 24-field domain literal that NOTHING tested
 * directly: its only coverage was the handful of `aegis.decrypt` conformance
 * rows, and the one that asked it for a token type was RED precisely because of
 * it. These tests are what pins the replacement on its own terms.
 */
describe("coseEncryptDomainHeader", () => {
  const kit = new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger: createMockLogger() });

  const headerOf = (options?: Parameters<CweKit["encrypt"]>[1]) =>
    coseEncryptDomainHeader(kit.encrypt(Buffer.from("sealed"), options));

  // RFC 9052 §5.2 — a COSE_Encrypt0 is single-recipient DIRECT encryption, so
  // label 1 is the CONTENT encryption and there is no key-management parameter
  // to read. `dir` is true of the structure; `encryption` is read off the wire.
  test("reports direct key management and the wire's own content encryption", () => {
    const header = headerOf();

    expect(header.algorithm).toBe("dir");
    expect(header.encryption).toBe("A256GCM");
  });

  // The two the hand-written literal hardcoded to `undefined` even though the
  // kit stamps both. `tokenType` additionally needed the `+cwe` media type to be
  // understood — the old recovery only knew `+cwt`.
  test("recovers the type the envelope declared", () => {
    const header = headerOf({ tokenType: "at" });

    expect(header.headerType).toBe("application/at+cwe");
    expect(header.tokenType).toBe("access_token");
  });

  test("reports the payload's content type", () => {
    expect(headerOf().contentType).toBe("application/octet-stream");
  });

  // From the UNPROTECTED bucket, which is where a COSE_Encrypt0 keeps both
  // (RFC 9052 §3.1 for the routing hint, §5.2 for the AEAD nonce) — and the two
  // parameters the header registry permits to travel there.
  test("admits the kid and iv the unprotected bucket carries", () => {
    const header = headerOf();

    expect(header.keyId).toBe(TEST_OCT_KEY_ENC.id);
    expect(header.initialisationVector).toEqual(expect.any(String));
  });

  // A COSE object is not a JOSE one, so the JOSE-family discriminant has nothing
  // to say about it.
  test("reports no JOSE base format", () => {
    expect(headerOf().baseFormat).toBe(undefined);
  });
});
