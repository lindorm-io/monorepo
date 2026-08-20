import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterAll, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import {
  decodeEncryptedCoseKid,
  decryptCose,
  encryptCose,
  isEncryptedCose,
} from "./cose-encryption.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { coseName } from "../claims/claims-registry.js";
import { domainToWire, wireToDomain } from "../claims/translate.js";
import { coseByJose } from "../header/header-registry.js";
import { encodeCbor, Tag } from "./cbor.js";
import { COSE_TAG, encodeProtectedHeader } from "./structures.js";

// Between the fixture's issuedAt (1700000000) and expiresAt (1700003600), so the
// in-kit temporal check accepts the round-tripped CWT.
MockDate.set(new Date(1700001000 * 1000));
afterAll(() => MockDate.reset());

const logger = createMockLogger();

const common = {
  issuer: "https://issuer.lindorm.io/",
  subject: "user-1",
  audience: ["https://rs.lindorm.io/"],
  expiresAt: new Date(1700003600 * 1000),
  issuedAt: new Date(1700000000 * 1000),
  tokenId: "the-jti",
};

// The COSE sign-then-encrypt BYTE path, pinned independently of the domain layer
// that drives it: translate the domain claims to the COSE wire, secure them as a
// COSE_Sign1, wrap that in a COSE_Encrypt0, then read the whole thing back.
//
// It used to drive two wrappers (`signCose` / `verifyCose`) that no longer exist —
// the single mint/verify pipeline calls the kit and the translator directly. The
// test is retargeted onto those rather than deleted, because it was the only thing
// pinning this round trip and deleting it with its subject would have left the
// survivor unchecked.
describe("COSE sign-then-encrypt", () => {
  const enc = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A256GCM" });

  test("round-trips through decrypt + verify", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const inner = kit.sign(domainToWire(common, coseName));
    expect(isEncryptedCose(inner)).toBe(false); // a bare signed CWT (COSE_Sign1)

    const encrypted = encryptCose({ kryptos: enc, logger, content: inner, options: {} });
    expect(isEncryptedCose(encrypted)).toBe(true); // a COSE_Encrypt0
    expect(decodeEncryptedCoseKid(encrypted)).toBe(enc.id); // recipient kid, no decrypt

    const decrypted = decryptCose({ kryptos: enc, logger, token: encrypted });
    const { payload } = kit.verify(decrypted);
    const { claims, custom } = wireToDomain(payload, coseName, "token");

    expect({ ...claims, ...custom }).toEqual(common);
  });
});

/**
 * ⭐ THE COSE_Encrypt0 KID READ RUNS BEFORE ANY KEY EXISTS. `aegis.decrypt` on a
 * CWE (`internal/wire/cose-token-wire.ts:337`) and `aegis.cwe.decrypt`
 * (`internal/utils/raw-decrypt-cwe.ts:35`) both call `decodeEncryptedCoseKid` to
 * choose the recipient key, so it shapes a stranger's bytes with nothing
 * authenticated yet — the same door class `internal/cose/decode-cwt-wire.ts`
 * holds to structural refusal.
 *
 * RFC 9052 §3 types the unprotected bucket as a `header_map`, but the slot is
 * whatever the producer wrote. `contents[1]` was cast straight to `Map` and
 * `.get` called on it, so a bucket that is not a map — an integer, or a
 * text-keyed CBOR map, which `preferMap: false` hands back as a plain object —
 * threw a raw `TypeError` rather than reading as "no kid stated".
 */
describe("a COSE_Encrypt0 whose unprotected bucket is not a map", () => {
  const protectedHeader = encodeProtectedHeader(
    new Map<number, unknown>([[coseByJose("alg"), 1]]),
  );

  const encrypt0 = (unprotected: unknown): Buffer =>
    Buffer.from(
      encodeCbor(
        new Tag(COSE_TAG.encrypt0, [
          protectedHeader,
          unprotected,
          Buffer.from("ciphertext", "utf8"),
        ]),
      ),
    );

  test.each([
    ["an integer", 7],
    ["a text string", "not-a-map"],
    ["an array", []],
    ["a byte string", Buffer.alloc(2)],
    ["a text-keyed map", { kid: "key_probe" }],
  ])("reads as no kid when the bucket is %s", (_name, unprotected) => {
    expect(decodeEncryptedCoseKid(encrypt0(unprotected))).toBeUndefined();
  });

  test("a conformant integer-keyed bucket still yields the kid", () => {
    const token = encrypt0(
      new Map<number, unknown>([[coseByJose("kid"), Buffer.from("key_probe", "utf8")]]),
    );

    expect(decodeEncryptedCoseKid(token)).toBe("key_probe");
  });
});
