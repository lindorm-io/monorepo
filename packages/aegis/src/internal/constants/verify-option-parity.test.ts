import { describe, expect, test } from "vitest";
import { VERIFY_OPTION_KEYS, VERIFY_OPTION_PARITY } from "./verify-option-parity.js";

describe("verify option parity", () => {
  // The contract itself. A silent edit to a row is a change to what aegis
  // promises across the two wires, so it has to surface in review.
  test("should match the recorded contract", () => {
    expect(VERIFY_OPTION_PARITY).toMatchSnapshot();
  });

  test("should derive the key set from the table", () => {
    expect(VERIFY_OPTION_KEYS).toMatchSnapshot();
  });

  // `wires: "jose" | "cose"` already demands a `reason` in the type. Diverging
  // DEFAULTS cannot be expressed the same way, so assert it here: a row where
  // the two wires resolve differently is a claim about two RFCs, and it must
  // say which.
  test("should justify every diverging default", () => {
    const unexplained = Object.entries(VERIFY_OPTION_PARITY)
      .filter(([, spec]) => spec.default.jose !== spec.default.cose)
      .filter(([, spec]) => !("reason" in spec && spec.reason))
      .map(([key]) => key);

    expect(unexplained).toEqual([]);
  });

  // A `bug` field is a row the code does not yet satisfy. It exists to be
  // deleted, so keep it visible: this is the parity backlog, and an empty list
  // is the finish line.
  test("should list the rows still awaiting a fix", () => {
    const outstanding = Object.entries(VERIFY_OPTION_PARITY)
      .filter(([, spec]) => "bug" in spec && spec.bug)
      .map(([key]) => key);

    expect(outstanding).toMatchSnapshot();
  });
});
