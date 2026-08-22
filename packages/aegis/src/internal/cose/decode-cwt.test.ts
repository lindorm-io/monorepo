import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG } from "../../__fixtures__/keys.js";
import { coseByJose } from "../header/header-registry.js";
import { Tag, encodeCbor } from "./cbor.js";
import { decodeCwt } from "./decode-cwt.js";
import { signCwt } from "./sign-cwt.js";
import { COSE_TAG, encodeProtectedHeader } from "./structures.js";

describe("decodeCwt", () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  const signed = (claims: Record<string, unknown>) =>
    signCwt(TEST_EC_KEY_SIG, logger, "cwt", claims, {});

  test("exposes the header triple", () => {
    const decoded = decodeCwt(signed({ iss: "https://iss.lindorm.io/", sub: "user-1" }));

    expect(decoded.kid).toBe(TEST_EC_KEY_SIG.id);
    expect(decoded.algorithm).toBe(TEST_EC_KEY_SIG.algorithm);
  });

  // The COSE mirror of `JwtKit.decode(...).payload`: a COSE_Sign1 payload is
  // cleartext CBOR, so the verify path can scope its key lookup by the still
  // UNVERIFIED `iss`.
  test("exposes the cleartext WIRE claims of a COSE_Sign1", () => {
    const decoded = decodeCwt(
      signed({ iss: "https://iss.lindorm.io/", sub: "user-1", cti: "token-1" }),
    );

    expect(decoded.payload).toMatchObject({
      iss: "https://iss.lindorm.io/",
      sub: "user-1",
      cti: "token-1",
    });
  });

  test("exposes the cleartext WIRE claims of a COSE_Mac0 too", () => {
    const token = signCwt(
      TEST_OCT_KEY_SIG,
      logger,
      "cwm",
      { iss: "https://iss.lindorm.io/", sub: "user-1" },
      {},
    );

    expect(decodeCwt(token).payload).toMatchObject({ iss: "https://iss.lindorm.io/" });
  });

  // A DETACHED payload is legal COSE and has no claims to read, so `payload` is
  // undefined. ⚠ The decode must not throw: its job is what a key resolution
  // needs, not a verdict on the structure.
  test("reports no claims for a DETACHED (nil) payload, without throwing", () => {
    const protectedHeader = encodeProtectedHeader(
      new Map<number, unknown>([[coseByJose("alg"), -7]]),
    );
    const unprotected = new Map<number, unknown>([
      [coseByJose("kid"), Buffer.from("detached-kid", "utf8")],
    ]);

    const token = encodeCbor(
      new Tag(
        COSE_TAG.cwt,
        new Tag(COSE_TAG.sign1, [protectedHeader, unprotected, null, Buffer.alloc(8)]),
      ),
    );

    const decoded = decodeCwt(token);

    expect(decoded.kid).toBe("detached-kid");
    expect(decoded.payload).toBeUndefined();
  });

  // ⚠ Where a non-string typ is answered on this wire. `verifyCwt`'s typ gate has
  // an `isString` guard nothing can reach, because this decode NORMALISES a
  // non-string to `undefined` and a typ-less CWT is well-formed. So a numeric typ
  // is not refused — it is unread.
  test("normalises a NON-STRING typ to undefined rather than reporting it", () => {
    const protectedHeader = encodeProtectedHeader(
      new Map<number, unknown>([
        [coseByJose("alg"), -7],
        [coseByJose("typ"), 123],
      ]),
    );
    const unprotected = new Map<number, unknown>([
      [coseByJose("kid"), Buffer.from("numeric-typ-kid", "utf8")],
    ]);

    const token = encodeCbor(
      new Tag(
        COSE_TAG.cwt,
        new Tag(COSE_TAG.sign1, [
          protectedHeader,
          unprotected,
          Buffer.alloc(0),
          Buffer.alloc(8),
        ]),
      ),
    );

    expect(decodeCwt(token).typ).toBeUndefined();
  });

  // The same decode serves the OPAQUE CWS path, whose payload is arbitrary bytes,
  // so unreadable bytes report "no claims" rather than a malformed token.
  test("reports no claims for an OPAQUE payload that is not a CBOR claims map", () => {
    const protectedHeader = encodeProtectedHeader(
      new Map<number, unknown>([[coseByJose("alg"), -7]]),
    );
    const unprotected = new Map<number, unknown>([
      [coseByJose("kid"), Buffer.from("opaque-kid", "utf8")],
    ]);

    const token = encodeCbor(
      new Tag(
        COSE_TAG.cwt,
        new Tag(COSE_TAG.sign1, [
          protectedHeader,
          unprotected,
          Buffer.from("not cbor claims, just bytes", "utf8"),
          Buffer.alloc(8),
        ]),
      ),
    );

    const decoded = decodeCwt(token);

    expect(decoded.kid).toBe("opaque-kid");
    expect(decoded.payload).toBeUndefined();
  });
});
