import { describe, expect, test } from "vitest";
import { CoseError, CwmError, CwsError, CwtError } from "../../errors/index.js";
import { ERROR_BY_FORMAT } from "./error-by-format.js";

describe("ERROR_BY_FORMAT", () => {
  test("each signed COSE format lands on its OWN leaf class", () => {
    // Namespacing is what lets a consumer catch one format's refusal without
    // catching another's; the opaque signer and the claims core used to keep
    // separate copies of this table, agreeing on cwt/cwm by coincidence.
    expect(ERROR_BY_FORMAT.cws).toBe(CwsError);
    expect(ERROR_BY_FORMAT.cwt).toBe(CwtError);
    expect(ERROR_BY_FORMAT.cwm).toBe(CwmError);
  });

  test("every leaf is still catchable as the shared COSE parent", () => {
    for (const leaf of Object.values(ERROR_BY_FORMAT)) {
      expect(new leaf("thrown", { code: "test" })).toBeInstanceOf(CoseError);
    }
  });

  test("the table covers the signed set and nothing else", () => {
    expect(Object.keys(ERROR_BY_FORMAT).sort()).toEqual(["cwm", "cws", "cwt"]);
  });
});
