import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { CwsKit } from "../../classes/CwsKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * The COSE FORMAT GUARDS — which COSE structure a token is, decided from its
 * bytes alone.
 *
 * They live here because `is-cose-format.ts` beside this file is where the
 * discrimination happens. They are exercised through the `Aegis` statics because
 * those are the public surface and each adds exactly one thing of its own: a
 * dotted token bails before any base64url or CBOR work, which is what keeps a
 * JOSE token from being decoded as garbage CBOR and answered about.
 *
 * ⚠ These cannot be conformance rows. A row states a capability by BUILDING an
 * artifact and ACTING on it; a guard is a total predicate over an arbitrary
 * string, and the answers that matter most are the ones it gives about strings
 * no artifact step could produce — a JOSE token, and a value that is not a token
 * at all.
 */
describe("COSE format guards", () => {
  let amphora: IAmphora;
  let aegis: Aegis;
  let cwt: string;
  let cwm: string;
  let cwe: string;
  let cws: string;

  // A well-formed JOSE JWT string — the dotted counter-example every COSE guard
  // must reject before it touches a byte.
  const seg = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const JWT = `${seg({ alg: "ES256", typ: "JWT" })}.${seg({ sub: "user_1" })}.sig`;

  beforeEach(async () => {
    const logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: "https://test.lindorm.io/" }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG); // ES512 signer — COSE_Sign1
    amphora.add(TEST_OCT_KEY_ENC); // dir recipient — COSE_Encrypt0

    // CWT — a claims-bearing COSE_Sign1 carrying a `<type>+cwt` media type.
    cwt = (
      await aegis.cwt.sign(
        { sub: "user-1", aud: ["https://rs.lindorm.io/"], exp: 1704099600 },
        { tokenType: "at" },
      )
    ).token;

    // CWM — the same claims, MAC-authenticated (COSE_Mac0). It needs its own
    // vault: a second signing resident on the shared one would make the keyless
    // cwt/cws auto-selection non-deterministic.
    const macLogger = createMockLogger();
    const macAmphora = new Amphora({
      internal: { issuer: "https://test.lindorm.io/" },
      logger: macLogger,
    });
    const macAegis = new Aegis({ amphora: macAmphora, logger: macLogger });
    await macAmphora.setup();
    macAmphora.add(TEST_OCT_KEY_SIG);

    cwm = (
      await macAegis.cwm.sign(
        { sub: "user-1", aud: ["https://rs.lindorm.io/"], exp: 1704099600 },
        { tokenType: "at" },
      )
    ).token;

    // CWE — a COSE_Encrypt0.
    cwe = (await aegis.cwe.encrypt("hello cose")).token;

    // CWS — an opaque COSE_Sign1. It shares the CWT's structure tag and is told
    // apart by its `<type>+cws` media type, exactly as a `+jws` JWS is told from
    // a `+jwt` JWT.
    cws = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger })
      .sign(Buffer.from("opaque payload"), { tokenType: "example" })
      .toString("base64url");
  });

  test("isCwt — true for a CWT, false for every other COSE structure and for JOSE", () => {
    expect(Aegis.isCwt(cwt)).toBe(true);
    expect(Aegis.isCwt(cwm)).toBe(false);
    expect(Aegis.isCwt(cws)).toBe(false);
    expect(Aegis.isCwt(cwe)).toBe(false);
    expect(Aegis.isCwt(JWT)).toBe(false);
    expect(Aegis.isCwt("not a token")).toBe(false);
  });

  test("isCwm — true for a CWM, false for every other COSE structure and for JOSE", () => {
    expect(Aegis.isCwm(cwm)).toBe(true);
    expect(Aegis.isCwm(cwt)).toBe(false);
    expect(Aegis.isCwm(cws)).toBe(false);
    expect(Aegis.isCwm(cwe)).toBe(false);
    expect(Aegis.isCwm(JWT)).toBe(false);
    expect(Aegis.isCwm("not a token")).toBe(false);
  });

  test("isCws — true for a CWS, false for every other COSE structure and for JOSE", () => {
    expect(Aegis.isCws(cws)).toBe(true);
    expect(Aegis.isCws(cwt)).toBe(false);
    expect(Aegis.isCws(cwm)).toBe(false);
    expect(Aegis.isCws(cwe)).toBe(false);
    expect(Aegis.isCws(JWT)).toBe(false);
    expect(Aegis.isCws("not a token")).toBe(false);
  });

  test("isCwe — true for a CWE, false for every other COSE structure and for JOSE", () => {
    expect(Aegis.isCwe(cwe)).toBe(true);
    expect(Aegis.isCwe(cwt)).toBe(false);
    expect(Aegis.isCwe(cwm)).toBe(false);
    expect(Aegis.isCwe(cws)).toBe(false);
    expect(Aegis.isCwe(JWT)).toBe(false);
    expect(Aegis.isCwe("not a token")).toBe(false);
  });

  // The two family umbrellas are EXACT counterparts: every token is at most one
  // wire family, and neither answers yes about something that is not a token.
  // Without the negative half, a guard that answered `true` unconditionally
  // would satisfy every case above that expects `true`.
  test("every COSE structure is COSE and no JOSE token is, and neither claims a non-token", () => {
    for (const token of [cwt, cwm, cws, cwe]) {
      expect(Aegis.isCose(token)).toBe(true);
      expect(Aegis.isJose(token)).toBe(false);
    }

    expect(Aegis.isCose(JWT)).toBe(false);
    expect(Aegis.isJose(JWT)).toBe(true);

    expect(Aegis.isCose("not a token")).toBe(false);
    expect(Aegis.isJose("not a token")).toBe(false);
  });
});
