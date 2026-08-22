import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import { CweKit } from "../../classes/CweKit.js";
import { JweKit } from "../../classes/JweKit.js";
import { decodeProtectedHeader } from "../cose/structures.js";
import { splitEncrypt0 } from "../cose/split-encrypt0.js";
import { coseByJose } from "../header/header-registry.js";
import { coseLabelToEnc } from "../cose/enc-labels.js";
import { splitJweCompact } from "./split-jwe-compact.js";
import { resolveContentEncryption } from "./resolve-content-encryption.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const logger = createMockLogger();

/**
 * The content-encryption floor, and specifically ITS TOP RUNG.
 *
 * The docblock calls key-first the security property: a key that DECLARES a
 * cipher is not overridable by a deployment default. Only the `A256GCM` bottom
 * rung was ever bound — by both kits' own tests, before and after the two inline
 * copies were collapsed into this function — so a fallback-first resolution
 * would have passed. That is the rung a caller relies on when it hands aegis a
 * key chosen for a particular cipher.
 *
 * ⚠ Driven through the KITS, not just the function. A unit test of the resolver
 * proves the resolver; what matters is that each kit ASKS it and puts the answer
 * on the wire, which is the seam the extraction moved.
 */
describe("the content-encryption floor resolves KEY FIRST", () => {
  test("the function prefers the key over the deployment default", () => {
    const key = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A128GCM" });

    expect(resolveContentEncryption(key, "A256GCM")).toBe("A128GCM");
  });

  test("and falls back only when the key declares none", () => {
    // ⚠ A REAL KEY, not a stub. Every GENERATED encryption key declares an
    // `encryption` (`enc.oct({ algorithm: "dir" })` comes back A256GCM), so the
    // lower two rungs are reached by re-importing one with the field stripped.
    //
    // ⚠⚠ And the state a real key holds is `null`, NOT `undefined` —
    // `Kryptos`'s constructor normalises `options.encryption || null`. A
    // `{ encryption: undefined }` stub needed a double cast to compile, modelled
    // a value the type forbids, and would have kept passing while every real key
    // regressed the moment `??` became an `isUndefined` guard — which is the
    // direction this project's own rules push. The assertion below pins the
    // premise so it cannot rot silently.
    const { enc: _enc, ...jwk } = KryptosKit.generate.enc
      .oct({ algorithm: "dir" })
      .toJWK("private");
    const declaresNone = KryptosKit.from.jwk(jwk);

    expect(declaresNone.encryption).toBeNull();

    expect(resolveContentEncryption(declaresNone, "A192GCM")).toBe("A192GCM");
    expect(resolveContentEncryption(declaresNone, undefined)).toBe("A256GCM");
  });

  test("JweKit seals with the KEY's cipher, not the deployment default", () => {
    const kryptos = KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "A128GCM",
    });

    const token = new JweKit({
      kryptos,
      logger,
      defaultEncryption: "A256GCM",
    }).encrypt("plaintext");

    expect(splitJweCompact(token).header.enc).toBe("A128GCM");
  });

  test("CweKit seals with the KEY's cipher, not the deployment default", () => {
    const kryptos = KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "A128GCM",
    });

    const token = new CweKit({
      kryptos,
      logger,
      defaultEncryption: "A256GCM",
    }).encrypt("plaintext");

    // Label 1 on a COSE_Encrypt0 carries the CONTENT encryption: the structure
    // has no recipients array and runs no recipient algorithm, so there is no key
    // management to name there. RFC 9052 §5.2.
    const header = decodeProtectedHeader(splitEncrypt0(token).protectedBstr);

    expect(coseLabelToEnc(header.get(coseByJose("alg")) as number)).toBe("A128GCM");
  });
});
