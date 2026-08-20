import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { toStepArgumentModel } from "./to-step-argument-model.js";

describe("toStepArgumentModel", () => {
  test("should map a DocString with a media type", () => {
    expect(
      toStepArgumentModel({ docString: { content: "hello body", mediaType: "json" } }),
    ).toEqual({ kind: "doc-string", content: "hello body", mediaType: "json" });
  });

  test("should OMIT the mediaType key when the DocString has none", () => {
    const argument = toStepArgumentModel({ docString: { content: "plain" } });

    expect(argument).toEqual({ kind: "doc-string", content: "plain" });
    // Absent, not undefined — byte-identical emitted source depends on it.
    expect(Object.hasOwn(argument, "mediaType")).toBe(false);
  });

  test("should carry hostile DocString content verbatim", () => {
    const content = '`${payload}`; "; import { evil } from "x";\nline sep';

    expect(toStepArgumentModel({ docString: { content } })).toEqual({
      kind: "doc-string",
      content,
    });
  });

  test("should map a DataTable to its cell matrix in row order", () => {
    expect(
      toStepArgumentModel({
        dataTable: {
          rows: [
            { cells: [{ value: "name" }, { value: "price" }] },
            { cells: [{ value: "apple" }, { value: "3" }] },
          ],
        },
      }),
    ).toEqual({
      kind: "data-table",
      rows: [
        ["name", "price"],
        ["apple", "3"],
      ],
    });
  });

  test("should carry a __proto__ table cell as a plain string", () => {
    expect(
      toStepArgumentModel({
        dataTable: { rows: [{ cells: [{ value: "__proto__" }, { value: "evil" }] }] },
      }),
    ).toEqual({ kind: "data-table", rows: [["__proto__", "evil"]] });
  });

  test("should throw model_invariant on an argument with neither member", () => {
    const error = capture(() => toStepArgumentModel({}));

    expect(error.code).toBe("model_invariant");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
