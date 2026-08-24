import { describe, expect, test } from "vitest";
import type { TokenProfile } from "../../types/index.js";
import { mintTypPrefix } from "./mint-typ-prefix.js";

/**
 * `mintTypPrefix` — the ONE profiled typ derivation, beside this file.
 *
 * Like its profile-less twin it answers a bare PREFIX, which each kit re-wraps in
 * its own format. That is what lets a single function serve both wires, and it is
 * the whole reason this is not a `TokenWire` member: the same three-step ladder
 * decides for a JWT and for a CWT, so there is nowhere for the two to disagree.
 *
 * The end-to-end proof that these answers reach the emitted header on BOTH wires
 * is the `typ` knob probe in `src/__fixtures__/knob-probes.ts`, which mints the
 * same profile twice and requires the two artifacts to differ.
 */
describe("mintTypPrefix", () => {
  const profile = (typ: TokenProfile["typ"]): TokenProfile => ({ typ }) as TokenProfile;

  const MANDATED = profile({ presence: "required", value: "application/at+jwt" });
  const NONE = profile({ presence: "none" });

  test("a profile's mandated type wins over everything the caller states", () => {
    expect(
      mintTypPrefix({
        contentTokenType: "id_token",
        profile: MANDATED,
        signTyp: "application/custom+jwt",
      }),
    ).toBe("at");
  });

  test("a profile that mandates none yields to the caller's explicit typ", () => {
    expect(
      mintTypPrefix({
        contentTokenType: "id_token",
        profile: NONE,
        signTyp: "application/custom+jwt",
      }),
    ).toBe("custom");
  });

  test("the content's own token type is the last resort", () => {
    expect(
      mintTypPrefix({
        contentTokenType: "access_token",
        profile: NONE,
        signTyp: undefined,
      }),
    ).toBe("at");
  });

  /**
   * ⚠ `null` and `undefined` both mean the caller stated nothing —
   * `SignTokenOptions.typ` admits `null`, so a derivation gating on `undefined`
   * alone would treat it as an explicit type and hand `extractTypPrefix` a
   * non-string.
   */
  test("a null typ is a caller stating nothing, not a caller stating null", () => {
    expect(
      mintTypPrefix({ contentTokenType: "access_token", profile: NONE, signTyp: null }),
    ).toBe("at");
  });

  test("a type with no structured form yields no prefix", () => {
    expect(
      mintTypPrefix({ contentTokenType: "id_token", profile: NONE, signTyp: undefined }),
    ).toBeUndefined();
  });

  test("nothing stated anywhere yields no prefix", () => {
    expect(
      mintTypPrefix({ contentTokenType: undefined, profile: NONE, signTyp: undefined }),
    ).toBeUndefined();
  });

  /**
   * ⭐ A PROFILE TYPE THAT IS NEITHER A `+jwt` MEDIA TYPE NOR THE BARE FORM has no
   * prefix to extract, and nothing validates a profile's `typ` when it is
   * registered (`internal/profiles/define-profile.ts` only defaults `use`). The
   * refusal is therefore the only thing between such a profile and a token typed
   * by neither its profile nor its caller — and it must fire on EVERY format, not
   * just the one whose suffix happens to be checked. RFC 8725 §3.11.
   */
  test("a profile type in no known form is refused rather than reduced", () => {
    expect(() =>
      mintTypPrefix({
        contentTokenType: undefined,
        profile: profile({ presence: "required", value: "application/foo+bar" }),
        signTyp: undefined,
      }),
    ).toThrow(/Unexpected typ header/);
  });
});
