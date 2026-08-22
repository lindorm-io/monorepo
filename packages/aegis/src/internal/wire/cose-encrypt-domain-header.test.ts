import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { TEST_OCT_KEY_ENC } from "../../__fixtures__/keys.js";
import { CweKit } from "../../classes/CweKit.js";
import { coseEncryptDomainHeader } from "./cose-encrypt-domain-header.js";

/**
 * The keyless COSE_Encrypt0 header read, which is what `aegis.decrypt` reports for
 * a `cwe` before it has the key.
 */
describe("coseEncryptDomainHeader", () => {
  const kit = new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger: createMockLogger() });

  const headerOf = (options?: Parameters<CweKit["encrypt"]>[1]) =>
    coseEncryptDomainHeader(kit.encrypt(Buffer.from("sealed"), options));

  // `dir` describes the structure; `encryption` is read off label 1. RFC 9052 §5.2.
  test("reports direct key management and the wire's own content encryption", () => {
    const header = headerOf();

    expect(header.algorithm).toBe("dir");
    expect(header.encryption).toBe("A256GCM");
  });

  // `tokenType` is recovered from the `+cwe` media type (`internal/utils/domain-header.ts`).
  test("recovers the type the envelope declared", () => {
    const header = headerOf({ tokenType: "at" });

    expect(header.headerType).toBe("application/at+cwe");
    expect(header.tokenType).toBe("access_token");
  });

  test("reports the payload's content type", () => {
    expect(headerOf().contentType).toBe("application/octet-stream");
  });

  // Both ride the UNPROTECTED bucket (RFC 9052 §3.1) — and are the two parameters
  // the header registry permits to travel there.
  test("admits the kid and iv the unprotected bucket carries", () => {
    const header = headerOf();

    expect(header.keyId).toBe(TEST_OCT_KEY_ENC.id);
    expect(header.initialisationVector).toEqual(expect.any(String));
  });

  test("reports no JOSE base format", () => {
    expect(headerOf().baseFormat).toBe(undefined);
  });
});
