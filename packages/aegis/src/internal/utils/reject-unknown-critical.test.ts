import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { CwtError, JwtError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import { HEADER_SPECS, headerJoseName } from "../header/header-registry.js";
import { isCritEligible } from "../header/is-crit-eligible.js";
import { rejectUnknownCritical } from "./reject-unknown-critical.js";
import { validateCrit } from "./validate-crit.js";

// The fixture key carries a fixed validity window, so the clock is pinned.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const logger = createMockLogger();

const header = (extra: Record<string, unknown>): WireTokenHeader =>
  ({ alg: "ES512", ...extra }) as WireTokenHeader;

const reject =
  (
    extra: Record<string, unknown>,
    unknown: Record<string, unknown> = {},
    declared?: ReadonlyArray<string>,
  ) =>
  (): void =>
    rejectUnknownCritical({
      header: header(extra),
      unknown,
      declared,
      format: "jwt",
      error: JwtError,
    });

describe("rejectUnknownCritical", () => {
  test("accepts a header with no crit at all", () => {
    expect(reject({})).not.toThrow();
  });

  test("refuses the extension aegis implements when nothing is declared", () => {
    // ⛔ `oid` GETS NO EXCEPTION. It is `critEligible: true` in the registry,
    // which is what lets a PRODUCER name it — but that says nothing about whether
    // the application behind this verify can act on it, and RFC 7515 §4.1.11 puts
    // that duty on the recipient. So the read gate does not read the column.
    expect(reject({ crit: ["oid"], oid: "1.2.3.4" })).toThrow(
      expect.objectContaining({
        code: "jwt_unsupported_crit_param",
        data: { param: "oid" },
      }),
    );
  });

  test("accepts the extension aegis implements once the caller declares it", () => {
    expect(reject({ crit: ["oid"], oid: "1.2.3.4" }, {}, ["oid"])).not.toThrow();
  });

  /**
   * ⛔⛔ EVERY ROW BELOW THAT PUTS AN UNREGISTERED MEMBER IN `header` DESCRIBES A
   * STATE NO PUBLIC DOOR PRODUCES, and each says so in its name. Both read paths
   * route a key the registry does not answer for into `unknown`
   * (`internal/utils/jose-header.ts`, `internal/header/cose-wire-header.ts`), so
   * `header: { crit: ["ext"], ext: "x" }, unknown: {}` is reachable only by
   * calling this function directly.
   *
   * They are kept because they probe the SPLIT the read side makes: a member that
   * lands in the typed bag is not a custom parameter, so no declaration can admit
   * it. What a real token does is pinned below and at the public door.
   */
  test("DIRECT CALL, unreachable state: an unregistered member in `header` is refused", () => {
    // The read gate admits a member only when the caller declared it, and this
    // call declares nothing.
    expect(reject({ crit: ["ext"], ext: "x" })).toThrow(
      expect.objectContaining({
        code: "jwt_unsupported_crit_param",
        data: { param: "ext" },
      }),
    );
  });

  test("DIRECT CALL, unreachable state: the first UNCLAIMED member is reported", () => {
    // Both members are real, present and not specification-defined, so both clear
    // the malformed branch. `oid` is DECLARED and is skipped; naming it in the
    // refusal would report a parameter the caller has already taken on.
    expect(
      reject({ crit: ["oid", "ext"], oid: "1.2.3.4", ext: "x" }, {}, ["oid"]),
    ).toThrow(expect.objectContaining({ data: { param: "ext" } }));
  });

  /**
   * ⭐ WHAT A REAL TOKEN DOES — the case the DIRECT-CALL rows above are NOT about.
   *
   * An unregistered member the header CARRIES is a custom parameter its issuer
   * marked critical, and the read side reports it in `unknown`. Whether it stands
   * turns on the CALLER: RFC 7515 §4.1.11 puts the duty to understand a critical
   * extension on the recipient, and aegis is never the final recipient, so it
   * refuses until the application declares the parameter.
   */
  test("refuses an unregistered member the header CARRIES when nothing is declared", () => {
    expect(reject({ crit: ["ext"] }, { ext: "x" })).toThrow(
      expect.objectContaining({
        code: "jwt_unsupported_crit_param",
        data: { param: "ext" },
      }),
    );
  });

  test("admits the same member once the caller declares it", () => {
    expect(reject({ crit: ["ext"] }, { ext: "x" }, ["ext"])).not.toThrow();
  });

  test("a declaration does NOT waive the presence rule", () => {
    // RFC 9052 §3.1 makes a crit label whose parameter is absent from the
    // protected bucket a fatal error, and declaring the name states nothing about
    // whether the token carries it. MALFORMED, not unsupported.
    expect(reject({ crit: ["ext"] }, {}, ["ext"])).toThrow(
      expect.objectContaining({ code: "jwt_invalid_crit" }),
    );
  });

  test("a declaration does NOT admit a specification-defined parameter", () => {
    // RFC 7515 §4.1.11 forbids a producer naming one at all, so no recipient can
    // take responsibility for it — `validateCrit` refuses before the declaration
    // is consulted.
    expect(reject({ crit: ["alg"] }, {}, ["alg"])).toThrow(
      expect.objectContaining({ code: "jwt_invalid_crit" }),
    );
  });

  test("PUBLIC DOOR: a minted custom critical parameter needs the same declaration", () => {
    // Byte-identical to what a conformant foreign producer with its own extension
    // emits — aegis is simply the producer here, which is the whole point: these
    // are the bytes the mint gate permits.
    const kit = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

    const token = kit.sign(
      { iss: "https://issuer.lindorm.io/", sub: "user-1" },
      { header: { crit: ["ext"] }, custom: { protected: { ext: "x" } } },
    );

    expect(() => kit.verify(token)).toThrow(
      expect.objectContaining({
        code: "jwt_unsupported_crit_param",
        data: { param: "ext" },
      }),
    );
    expect(() => kit.verify(token, undefined, { crit: ["ext"] })).not.toThrow();
  });

  test("refuses a MALFORMED crit distinctly from an unrecognised one", () => {
    // The distinction is what makes a refusal attributable: a token refused for
    // being malformed says nothing about whether aegis implements the extension.
    for (const crit of [[], "oid", [1]]) {
      expect(reject({ crit })).toThrow(
        expect.objectContaining({ code: "jwt_invalid_crit" }),
      );
    }
  });

  test("refuses a crit naming a parameter that is not in the header it was read from", () => {
    // RFC 7515 §4.1.11 and RFC 9052 §3.1 both make this fatal — on COSE in those
    // exact words. On COSE the header handed in is the PROTECTED bucket, so this
    // is also what refuses a crit member whose parameter rode the unsigned one.
    expect(reject({ crit: ["oid"] })).toThrow(
      expect.objectContaining({ code: "jwt_invalid_crit" }),
    );
  });

  test("refuses a crit naming a parameter carried with an EMPTY value as MALFORMED", () => {
    // ⚠ MALFORMED, not unrecognised, and the distinction is the point. `crit`
    // says a recipient must understand the parameter's VALUE; an empty one gives
    // it nothing to understand, so the header is broken before the question of
    // whether aegis implements the extension arises. Both refuse — this one says
    // why more accurately.
    expect(reject({ crit: ["oid"], oid: "" })).toThrow(
      expect.objectContaining({ code: "jwt_invalid_crit" }),
    );
  });

  test("refuses a crit naming an IANA-registered parameter (crit is for extensions)", () => {
    expect(reject({ crit: ["alg"] })).toThrow(
      expect.objectContaining({ code: "jwt_invalid_crit" }),
    );
  });

  /**
   * ⚠ A CALLER-CONTROLLED MEMBER IS LOOKED UP STRUCTURALLY. The eligibility
   * lookup is a `Map` read (`headerByJose`), which has no prototype chain — a
   * plain-object registry would answer for `"toString"` with a function, and
   * `fn?.critEligible === true` would only be false by luck. `crit: ["toString"]`
   * has got through this package's crit path twice.
   *
   * ⚠ These reach the ELIGIBILITY branch rather than the malformed one only
   * because the header carries the member: `validate-crit.ts` uses
   * `Object.hasOwn`, so a header that did NOT carry it would be refused as
   * malformed first and this branch would go unprobed.
   */
  test.each(["toString", "constructor", "valueOf", "hasOwnProperty"])(
    "DIRECT CALL, unreachable state: the Object.prototype member %s is refused",
    (member) => {
      expect(reject({ crit: [member], [member]: "x" })).toThrow(
        expect.objectContaining({
          code: "jwt_unsupported_crit_param",
          data: { param: member },
        }),
      );
    },
  );

  /**
   * ⭐ THE TWO GATES, BOUND. `rejectUnknownCritical` runs `validateCrit` FIRST,
   * and `validateCrit` refuses every SPECIFICATION-DEFINED name
   * ({@link isSpecDefinedHeaderParam}). So a `crit` aegis MINTS survives its own
   * malformed gate only while every `critEligible: true` parameter answers FALSE
   * to that predicate. (Surviving it is not acceptance — the declaration check
   * below still applies.)
   *
   * ⚠ THE PREDICATE'S REGISTRY HALF READS THE `spec` COLUMN, not `critEligible`,
   * so this row keeps the invariant honest rather than establishing it: a row
   * whose `spec.kind` is `policy` is the only registry parameter that can be
   * crit-eligible, and `policy` is frozen to `oid`
   * (`is-spec-defined-header-param.test.ts`). ⛔ A predicate reading
   * `critEligible` instead would break exactly here: RFC 7797 §6 requires
   * `crit: ["b64"]` on a conformant unencoded-payload JWS, so implementing `b64`
   * means marking it crit-eligible — and that would flip a parameter RFC 7797
   * DEFINES to "not spec-defined", admitting it into `custom` while this line goes
   * on refusing it.
   *
   * ⚠ Asserted BEHAVIOURALLY, through the real read path, rather than by
   * comparing two sets: what matters is that an eligible parameter actually
   * SURVIVES the read.
   *
   * ⚠ `b64` is the live limitation, and it is not a defect to trim away. RFC 7797
   * §6 REQUIRES `crit: ["b64"]` on a conformant unencoded-payload JWS, so aegis
   * cannot produce one — correctly, because it does not implement the unencoded
   * payload. Removing `b64` from the predicate would let a caller mint a token
   * DECLARING that option while the payload was base64url-encoded anyway.
   */
  test("every crit-eligible parameter survives the read path's malformed gate", () => {
    const eligible = HEADER_SPECS.filter((spec) => isCritEligible(headerJoseName(spec)));

    expect(eligible.length, "no parameter is eligible, so this asserts nothing").toBe(1);

    for (const spec of eligible) {
      const jose = headerJoseName(spec);

      // A non-empty value under the parameter's own name is all `validateCrit`
      // requires beyond the name itself; the VALUE's shape is the codec's
      // business, not this gate's.
      expect(
        validateCrit({ crit: [jose], [jose]: "x" }),
        `crit: ["${jose}"] is eligible at mint but refused as malformed on read`,
      ).toBeNull();

      // DECLARED, because no registry column can ADMIT a member here (the `spec`
      // column above only refuses): what this row asserts is that an eligible
      // parameter is not refused as MALFORMED, which is the half the write side
      // depends on.
      expect(reject({ crit: [jose], [jose]: "x" }, {}, [jose])).not.toThrow();
    }
  });

  /**
   * ⭐ THE READ PATH REACHES NO REGISTERED PARAMETER AT ALL, which is what makes
   * the write side's `critEligible` column unobservable from this door and why
   * `internal/header/is-crit-eligible.test.ts` is where it is probed.
   * `validateCrit` refuses every IANA-registered member before this gate's loop
   * runs, and `oid` — the one registered member that survives — is decided here by
   * the CALLER's declaration rather than by any column.
   *
   * ⚠ THIS TEST IS THE TRIPWIRE for the first half of that. The day a registered
   * parameter is absent from the IANA list — a second proprietary parameter, or
   * the `b64`/`ppt`/`svt` trim — it goes RED, and at that moment the read gate can
   * be handed a registered member it has no rule about.
   */
  test("no registered parameter but oid survives the read path's malformed gate", () => {
    const ineligible = HEADER_SPECS.map(headerJoseName).filter(
      (jose) => !isCritEligible(jose),
    );

    expect(ineligible.length).toBe(HEADER_SPECS.length - 1);

    for (const jose of ineligible) {
      expect(
        validateCrit({ crit: [jose], [jose]: "x" }),
        `${jose} is registered, ineligible and NOT refused as malformed — the eligibility branch is now reachable from this door and owes a probe`,
      ).not.toBeNull();
    }
  });

  test("DIRECT CALL, unreachable state: both codes are namespaced by the FORMAT", () => {
    // The same implementation serves both wires; only the format tag and the
    // error class differ. That is the whole point — a hostile token cannot be
    // refused on one wire and accepted on the other.
    expect(() =>
      rejectUnknownCritical({
        header: header({ crit: ["ext"], ext: "x" }),
        unknown: {},
        declared: undefined,
        format: "cwt",
        error: CwtError,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "cwt_unsupported_crit_param",
        data: { param: "ext" },
      }),
    );
  });
});
