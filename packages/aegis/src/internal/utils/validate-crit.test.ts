import type { WireTokenHeader } from "../../types/header/wire-header.js";
import { validateCrit } from "./validate-crit.js";
import { describe, expect, test } from "vitest";

const base: WireTokenHeader = {
  alg: "ES256",
  typ: "JWT",
};

describe("validateCrit", () => {
  test("returns null when crit is absent", () => {
    expect(validateCrit(base)).toBeNull();
  });

  test("returns null when crit lists an extension parameter that exists", () => {
    const header = {
      ...base,
      crit: ["my_ext"],
      my_ext: "value",
    } as unknown as WireTokenHeader;

    expect(validateCrit(header)).toBeNull();
  });

  test("rejects empty crit array", () => {
    const header = { ...base, crit: [] } as WireTokenHeader;
    expect(validateCrit(header)).toMatch(/empty/);
  });

  test("rejects crit containing a non-string", () => {
    const header = { ...base, crit: [42] } as unknown as WireTokenHeader;
    expect(validateCrit(header)).toMatch(/must be strings/);
  });

  test("rejects crit containing an IANA-registered param (alg)", () => {
    const header = { ...base, crit: ["alg"] } as WireTokenHeader;
    expect(validateCrit(header)).toMatch(/IANA-registered/);
  });

  test("rejects crit containing an IANA-registered param (kid)", () => {
    const header = { ...base, crit: ["kid"] } as WireTokenHeader;
    expect(validateCrit(header)).toMatch(/IANA-registered/);
  });

  test("rejects crit containing an IANA-registered param (b64)", () => {
    const header = {
      ...base,
      crit: ["b64"],
      b64: false,
    } as unknown as WireTokenHeader;
    expect(validateCrit(header)).toMatch(/IANA-registered/);
  });

  test("rejects crit listing a name that is not present in the header", () => {
    const header = { ...base, crit: ["missing_param"] } as WireTokenHeader;
    expect(validateCrit(header)).toMatch(/not present/);
  });

  /**
   * The same requirement one step further in, stated for each shape a producer
   * can write it as. `crit` says a recipient MUST understand the parameter's
   * VALUE, so a present-but-empty one satisfies the list no better than an absent
   * one — and the writer refuses the identical shape at mint
   * (`header/assert-crit-satisfied.ts`), so aegis gives one answer on both sides.
   */
  test("rejects crit listing a name whose value is EMPTY", () => {
    for (const value of ["", null, [], {}]) {
      const header = {
        ...base,
        crit: ["extension"],
        extension: value,
      } as unknown as WireTokenHeader;

      expect(validateCrit(header)).toMatch(/has an empty value/);
    }
  });

  test("accepts a crit-listed name whose value is zero, false or empty bytes", () => {
    // The `isEmpty` boundary, and it is the same one the write-side prune uses:
    // `0` and `false` are VALUES a recipient can act on, and a zero-length Buffer
    // is bytes. Reading them as "nothing to understand" would refuse a token
    // whose critical parameter says something quite specific.
    for (const value of [0, false, Buffer.alloc(0)]) {
      const header = {
        ...base,
        crit: ["extension"],
        extension: value,
      } as unknown as WireTokenHeader;

      expect(validateCrit(header)).toBeNull();
    }
  });

  test("accepts oid-style extension as long as it is present", () => {
    // Note: this is a hypothetical test to show the mechanism — aegis should
    // never actually put `oid` in crit because it is informational, not
    // critical. See the commit message on the crit tightening commit for
    // reasoning.
    const header = {
      ...base,
      crit: ["oid"],
      oid: "some-id",
    } as unknown as WireTokenHeader;

    // `oid` is NOT in the IANA registry (it's a Lindorm extension), and it
    // exists in the header, so validateCrit accepts it at the RFC level.
    // Whether it SHOULD be marked critical is a separate policy question.
    expect(validateCrit(header)).toBeNull();
  });

  /**
   * ⚠ THE MEMBERSHIP TEST IS AN OWN-KEY TEST, and the member comes off a token a
   * STRANGER wrote. Spelled `name in decoded`, it resolved through
   * `Object.prototype`: `crit: ["toString"]` was "present in the header" of every
   * token ever decoded, and `isEmpty` calls a function non-empty, so the read side
   * accepted a `crit` naming a parameter no header carries — the same shape the
   * writer refuses. `in` on a caller-influenced key is a BANNED construct in this
   * package; `Object.hasOwn` is the only membership test to use.
   */
  test.each(["toString", "constructor", "valueOf", "hasOwnProperty", "__proto__"])(
    "rejects crit listing the Object.prototype member %s",
    (member) => {
      const header = { ...base, crit: [member] } as unknown as WireTokenHeader;

      expect(validateCrit(header)).toMatch(/is not present in the header/);
    },
  );
});
