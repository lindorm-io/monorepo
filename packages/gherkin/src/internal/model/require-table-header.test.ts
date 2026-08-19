import type { Examples } from "@cucumber/messages";
import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { requireTableHeader } from "./require-table-header.js";

const examples = (overrides: Partial<Examples>): Examples => ({
  description: "",
  id: "5",
  keyword: "Examples",
  location: { column: 5, line: 6 },
  name: "",
  tableBody: [],
  tags: [],
  ...overrides,
});

describe("requireTableHeader", () => {
  test("should return the header row", () => {
    const tableHeader = {
      cells: [{ location: { column: 9, line: 7 }, value: "enc" }],
      id: "3",
      location: { column: 7, line: 7 },
    };

    expect(requireTableHeader(examples({ tableHeader }))).toBe(tableHeader);
  });

  test("should throw when the parser reports no header row", () => {
    const error = capture(() => requireTableHeader(examples({})));

    expect(error.code).toBe("model_invariant");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
