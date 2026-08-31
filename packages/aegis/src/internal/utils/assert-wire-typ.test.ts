import { describe, expect, test } from "vitest";
import {
  CwmError,
  CwtError,
  CweError,
  CwsError,
  JweError,
  JwsError,
  JwtError,
} from "../../errors/index.js";
import { assertWireTyp } from "./assert-wire-typ.js";

/**
 * The configurations aegis actually runs, one constant per call site:
 *
 * - {@link JWT} — `JwtKit.verify` (`classes/JwtKit.ts`).
 * - {@link JWT_PARSE} — the JOSE wire's keyless `decodeClaims`
 *   (`internal/wire/jose-token-wire.ts`), which differs from `JWT` by ONE WORD.
 * - {@link JWS} — `JwsKit.verify` (`classes/JwsKit.ts`).
 * - {@link JWE} — `JweKit.decrypt` (`classes/JweKit.ts`).
 * - {@link CWT} — `verifyCwt`, serving both claims kits
 *   (`internal/cose/verify-cwt.ts`), whose `code` is namespaced per format.
 * - {@link CWT_PARSE} — the COSE wire's keyless read
 *   (`internal/wire/cose-token-wire.ts`), the same one-word split as `JWT_PARSE`.
 * - {@link CWE} — `CweKit.decrypt` (`classes/CweKit.ts`).
 * - {@link CWS} — `CwsKit.verify` (`classes/CwsKit.ts`).
 *
 * ⚠ These constants pin the PREDICATE, not the call sites: nothing here reads
 * production, so a config edited in a kit still passes every row below. What the
 * CALL SITES pass is pinned by driving them — `jose-token-wire.test.ts` for the
 * (1)/(2) wording split, `JweKit.test.ts` for the required presence, the kit
 * tests for the rest.
 */
const JWT = {
  accept: ["JWT"],
  suffix: "+jwt",
  presence: "optional",
  error: JwtError,
  code: "jwt_invalid_typ",
  title: "JWT Invalid Typ",
  details:
    "Header typ is present but is not JWT or a <type>+jwt media type, so the token cannot be verified as a JWT.",
} as const;

/**
 * The JOSE wire's KEYLESS read (`aegis.parse`). Identical to {@link JWT} — same
 * code, same title, same grammar — except for the last word of `details`:
 *
 * - {@link JWT} says the token "cannot be **verified** as a JWT". Its site
 *   `JwtKit.verify` is about to check a signature.
 * - This one says the token "cannot be **parsed** as a JWT". Its site never
 *   verifies anything: `aegis.parse` is keyless and unauthenticated.
 *
 * ⛔ NOT a copy-paste slip — do NOT collapse the two into one wording. Each
 * sentence names the operation its caller actually asked for, and telling a
 * `parse` caller their token "cannot be verified" would describe a check that
 * path does not run.
 */
const JWT_PARSE = {
  ...JWT,
  details:
    "Header typ is present but is not JWT or a <type>+jwt media type, so the token cannot be parsed as a JWT.",
} as const;

const JWS = {
  accept: ["JWS", "JOSE"],
  suffix: "+jws",
  presence: "optional",
  error: JwsError,
  code: "jws_invalid_typ",
  title: "JWS Invalid Typ",
  details: "Header typ must be JWS, JOSE, a <type>+jws media type, or undefined.",
} as const;

const JWE = {
  accept: ["JWE"],
  suffix: "+jwe",
  presence: "required",
  error: JweError,
  code: "jwe_invalid_typ",
  title: "JWE Invalid Typ",
  details: "Header typ must be JWE or a <type>+jwe media type to decrypt as a JWE.",
} as const;

const CWT = {
  accept: ["application/cwt"],
  suffix: "+cwt",
  presence: "optional",
  error: CwtError,
  code: "cwt_invalid_typ",
  title: "CWT Invalid Typ",
  details:
    "Header typ is present but is not CWT or a <type>+cwt media type, so the token cannot be verified as a CWT.",
} as const;

/**
 * The COSE wire's KEYLESS read. The same one-word split {@link JWT_PARSE} makes
 * against {@link JWT}, for the same reason: that site never verifies anything.
 */
const CWT_PARSE = {
  ...CWT,
  details:
    "Header typ is present but is not CWT or a <type>+cwt media type, so the token cannot be parsed as a CWT.",
} as const;

const CWE = {
  accept: ["application/cwe"],
  suffix: "+cwe",
  presence: "optional",
  error: CweError,
  code: "cwe_invalid_typ",
  title: "CWE Invalid Typ",
  details:
    "Header typ must be application/cwe or a <type>+cwe media type to decrypt as a COSE_Encrypt0.",
} as const;

const CWS = {
  accept: ["application/cws"],
  suffix: "+cws",
  presence: "optional",
  error: CwsError,
  code: "cws_invalid_typ",
  title: "CWS Invalid Typ",
  details:
    "Header typ must be application/cws or a <type>+cws media type to verify as a COSE_Sign1/COSE_Mac0.",
} as const;

describe("assertWireTyp", () => {
  describe("the exact spellings each family accepts", () => {
    test.each([
      ["JWT", JWT, "JWT"],
      ["JWT (parse)", JWT_PARSE, "JWT"],
      ["JWS", JWS, "JWS"],
      ["JWS (JOSE)", JWS, "JOSE"],
      ["JWE", JWE, "JWE"],
      ["CWT", CWT, "application/cwt"],
      ["CWT (parse)", CWT_PARSE, "application/cwt"],
      ["CWE", CWE, "application/cwe"],
      ["CWS", CWS, "application/cws"],
    ])("%s accepts %#", (_name, config, typ) => {
      expect(() => assertWireTyp({ ...config, typ })).not.toThrow();
    });
  });

  describe("the structured <type>+<suffix> syntax", () => {
    test.each([
      [JWT, "at+jwt"],
      [JWT, "dpop+jwt"],
      [JWT_PARSE, "at+jwt"],
      [JWS, "example+jws"],
      [JWE, "example+jwe"],
      [CWT, "at+cwt"],
      [CWT_PARSE, "at+cwt"],
      [CWE, "at+cwe"],
      [CWS, "at+cws"],
    ])("accepts %#", (config, typ) => {
      expect(() => assertWireTyp({ ...config, typ })).not.toThrow();
    });
  });

  test("a typ-LESS token is well-formed wherever presence is optional", () => {
    // Presence requiredness is a DOMAIN/profile policy, not a wire-grammar one —
    // RFC 7515 §4.1.9 makes typ optional and an id_token carries none.
    for (const config of [JWT, JWT_PARSE, JWS, CWT, CWT_PARSE, CWE, CWS]) {
      expect(() => assertWireTyp({ ...config, typ: undefined })).not.toThrow();
    }
  });

  test("⚠ a typ-LESS JWE is REFUSED — the one wire where presence is required", () => {
    expect(() => assertWireTyp({ ...JWE, typ: undefined })).toThrow(
      expect.objectContaining({ code: "jwe_invalid_typ", data: { typ: undefined } }),
    );
  });

  describe("each wire refuses a foreign typ under its OWN code and words", () => {
    test.each([
      ["jwt", JWT, "JWS"],
      ["jwt (parse)", JWT_PARSE, "JWS"],
      ["jws", JWS, "JWT"],
      ["jwe", JWE, "JWT"],
      ["cwt", CWT, "JWT"],
      ["cwt (parse)", CWT_PARSE, "JWT"],
      ["cwe", CWE, "application/at+cwt"],
      ["cws", CWS, "application/at+cwt"],
    ])("%s", (_name, config, typ) => {
      let thrown: { code?: string; title?: string; details?: string; data?: unknown } =
        {};

      try {
        assertWireTyp({ ...config, typ });
      } catch (error) {
        thrown = error as typeof thrown;
      }

      expect({
        code: thrown.code,
        title: thrown.title,
        details: thrown.details,
        data: thrown.data,
      }).toMatchSnapshot();
    });
  });

  test("the refusal lands on the leaf error class the caller named", () => {
    // Namespacing is what lets a consumer catch one wire's refusal without
    // catching the other's; a shared predicate must not flatten that.
    expect(() => assertWireTyp({ ...JWT, typ: "JWS" })).toThrow(JwtError);
    expect(() => assertWireTyp({ ...JWS, typ: "JWT" })).toThrow(JwsError);
    expect(() => assertWireTyp({ ...JWE, typ: "JWT" })).toThrow(JweError);
    expect(() => assertWireTyp({ ...CWT, typ: "JWT" })).toThrow(CwtError);
    expect(() => assertWireTyp({ ...CWE, typ: "JWT" })).toThrow(CweError);
    expect(() => assertWireTyp({ ...CWS, typ: "JWT" })).toThrow(CwsError);
  });

  test("the code, class and title the caller supplies are the ones raised", () => {
    // ⚠ This predicate REPORTS what it is handed; it decides none of it. A
    // hardcoded title beside a derived code makes a COSE_Mac0 answer under two
    // spellings depending on which typ gate fired, so this config states what the
    // only real `cwm` caller actually passes.
    //
    // ⚠ And it can only ever state it. Nothing here observes a call site, so
    // this row cannot notice `verifyCwt` reverting: `CwtKit.test.ts` and
    // `cose-token-wire.test.ts` are what bind the two real `cwm` doors.
    expect(() =>
      assertWireTyp({
        ...CWT,
        error: CwmError,
        code: "cwm_invalid_typ",
        title: "CWM Invalid Typ",
        typ: "JWT",
      }),
    ).toThrow(
      expect.objectContaining({ code: "cwm_invalid_typ", title: "CWM Invalid Typ" }),
    );
  });

  test("the suffix must be the WHOLE structured suffix, not a substring", () => {
    // `application/jwt-ish` ends with neither `+jwt` nor equals `JWT`.
    expect(() => assertWireTyp({ ...JWT, typ: "application/jwt" })).toThrow(
      expect.objectContaining({ code: "jwt_invalid_typ" }),
    );
  });

  test("a NON-STRING typ is refused as the wire's own error, not a TypeError", () => {
    // ⚠ The predicate guards `isString` before reaching `endsWith`. The call
    // sites this replaced did not, so a non-string typ would have surfaced as a
    // raw `TypeError`. It is DEFENSIVE only: no wire delivers one — the JOSE
    // wires refuse it in `decodeJoseHeader` and the COSE wires normalise it to
    // `undefined` in `decodeCwt` (both pinned by their own suites).
    for (const typ of [123, null, {}, ["JWT"]]) {
      expect(() => assertWireTyp({ ...JWT, typ: typ as unknown as string })).toThrow(
        expect.objectContaining({ code: "jwt_invalid_typ", data: { typ } }),
      );
    }
  });

  test("the accepted spellings are CASE-SENSITIVE", () => {
    // The kits compare the header verbatim; a lowercase `jwt` has never passed.
    expect(() => assertWireTyp({ ...JWT, typ: "jwt" })).toThrow(
      expect.objectContaining({ code: "jwt_invalid_typ" }),
    );
  });
});
