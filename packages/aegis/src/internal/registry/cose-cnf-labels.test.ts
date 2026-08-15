import { describe, expect, test } from "vitest";
import { COSE_CNF_LABELS, COSE_CNF_MEMBERS } from "./cose-cnf-labels.js";

describe("COSE_CNF_LABELS", () => {
  /**
   * ⭐ THE LITERAL PIN. Everything else about the COSE confirmation is derived
   * from this table — the capability row, the encoder's labels, the decoder's —
   * so nothing else in the package can say whether the table itself is right.
   *
   * ⚠ The LABELS as well as the member names. A wrong label mints a confirmation
   * no RFC 8747 reader can interpret, and every derived check would still agree
   * with it, because they all read the same wrong number.
   *
   * What the CODEC does with the table is pinned beside the codec, in
   * `cose/cose-key.test.ts`.
   */
  test("is exactly the two members RFC 8747 gives aegis a label for", () => {
    expect(COSE_CNF_LABELS).toEqual({ jwk: 1, kid: 3 });
    expect(COSE_CNF_MEMBERS).toEqual(["jwk", "kid"]);
  });
});
