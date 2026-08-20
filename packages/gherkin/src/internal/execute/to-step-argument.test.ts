import { describe, expect, test } from "vitest";
import { DataTable } from "../../classes/DataTable.js";
import { DocString } from "../../classes/DocString.js";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { toStepArgument } from "./to-step-argument.js";

describe("toStepArgument", () => {
  test("should return undefined for an absent argument — the slot still fills", () => {
    expect(toStepArgument(undefined)).toBeUndefined();
  });

  test("should build a DocString with its media type", () => {
    const doc = toStepArgument({
      kind: "doc-string",
      content: "hello body",
      mediaType: "markdown",
    });

    expect(doc).toBeInstanceOf(DocString);
    expect(doc).toEqual({ content: "hello body", mediaType: "markdown" });
  });

  test("should build a DocString without a media type", () => {
    expect(toStepArgument({ kind: "doc-string", content: "plain" })).toEqual({
      content: "plain",
      mediaType: undefined,
    });
  });

  test("should build a DataTable from the model rows", () => {
    const table = toStepArgument({
      kind: "data-table",
      rows: [
        ["name", "price"],
        ["apple", "3"],
      ],
    });

    expect(table).toBeInstanceOf(DataTable);
    expect((table as DataTable).hashes()).toEqual([{ name: "apple", price: "3" }]);
  });

  test("should copy the model rows — mutating the table never corrupts the model", () => {
    const rows = [["name"], ["apple"]];
    const table = toStepArgument({ kind: "data-table", rows }) as DataTable;

    table.raw()[1][0] = "corrupted";

    expect(rows).toEqual([["name"], ["apple"]]);
  });

  test("should throw model_invariant on an unknown kind", () => {
    const error = capture(() => toStepArgument({ kind: "unknown" } as never));

    expect(error.code).toBe("model_invariant");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
