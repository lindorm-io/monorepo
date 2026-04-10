import { DecodedTokenHeader } from "../../types/header";
import { validateCrit } from "./validate-crit";

const base: DecodedTokenHeader = {
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
    } as unknown as DecodedTokenHeader;

    expect(validateCrit(header)).toBeNull();
  });

  test("rejects empty crit array", () => {
    const header = { ...base, crit: [] } as DecodedTokenHeader;
    expect(validateCrit(header)).toMatch(/empty/);
  });

  test("rejects crit containing a non-string", () => {
    const header = { ...base, crit: [42] } as unknown as DecodedTokenHeader;
    expect(validateCrit(header)).toMatch(/must be strings/);
  });

  test("rejects crit containing an IANA-registered param (alg)", () => {
    const header = { ...base, crit: ["alg"] } as DecodedTokenHeader;
    expect(validateCrit(header)).toMatch(/IANA-registered/);
  });

  test("rejects crit containing an IANA-registered param (kid)", () => {
    const header = { ...base, crit: ["kid"] } as DecodedTokenHeader;
    expect(validateCrit(header)).toMatch(/IANA-registered/);
  });

  test("rejects crit containing an IANA-registered param (b64)", () => {
    const header = {
      ...base,
      crit: ["b64"],
      b64: false,
    } as unknown as DecodedTokenHeader;
    expect(validateCrit(header)).toMatch(/IANA-registered/);
  });

  test("rejects crit listing a name that is not present in the header", () => {
    const header = { ...base, crit: ["missing_param"] } as DecodedTokenHeader;
    expect(validateCrit(header)).toMatch(/not present/);
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
    } as unknown as DecodedTokenHeader;

    // `oid` is NOT in the IANA registry (it's a Lindorm extension), and it
    // exists in the header, so validateCrit accepts it at the RFC level.
    // Whether it SHOULD be marked critical is a separate policy question.
    expect(validateCrit(header)).toBeNull();
  });
});
