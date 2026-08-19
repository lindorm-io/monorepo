import { Errors } from "@cucumber/gherkin";
import { describe, expect, test } from "vitest";
import { errorShape } from "../../__fixtures__/test-helpers.js";
import { createParseError, toParseErrorEntries } from "./parse-error.js";

describe("toParseErrorEntries", () => {
  test("should unpack a CompositeParserException, anchoring each child that has a location", () => {
    const entries = toParseErrorEntries(
      Errors.CompositeParserException.create([
        Errors.ParserException.create("unexpected token", 4, 3),
        new Error("plain child without a location"),
      ]),
    );

    expect(entries).toEqual([
      { column: 3, line: 4, message: "(4:3): unexpected token" },
      { message: "plain child without a location" },
    ]);
  });

  test("should map a single ParserException", () => {
    expect(toParseErrorEntries(Errors.ParserException.create("boom", 7, 12))).toEqual([
      { column: 12, line: 7, message: "(7:12): boom" },
    ]);
  });

  test("should map a NoSuchLanguageException without a location to a message-only entry", () => {
    expect(toParseErrorEntries(Errors.NoSuchLanguageException.create("xx"))).toEqual([
      { message: "(-1:-1): Language not supported: xx" },
    ]);
  });

  test("should map an AstBuilderException whose location has no column", () => {
    expect(
      toParseErrorEntries(Errors.AstBuilderException.create("bad ast", { line: 7 })),
    ).toEqual([{ line: 7, message: "(7:0): bad ast" }]);
  });

  test("should rethrow anything that is not a Gherkin exception", () => {
    const error = new Error("not a parse failure");

    try {
      toParseErrorEntries(error);
    } catch (caught) {
      expect(caught).toBe(error);
      return;
    }

    throw new Error("expected toParseErrorEntries to rethrow");
  });
});

describe("createParseError", () => {
  test("should carry the parse_error taxonomy code with the anchored entries as data", () => {
    const error = createParseError({
      errors: [{ column: 3, line: 4, message: "(4:3): unexpected token" }],
      kind: "parse-error",
      uri: "src/features/broken.feature",
    });

    expect(error.code).toBe("parse_error");
    expect(error.type).toBe("urn:lindorm:gherkin:error:parse_error");
    // The MESSAGE carries the anchored entries — the reporter prints only the
    // message, so entries living in error.data alone would point at nothing.
    expect(error.message).toContain("(4:3): unexpected token");
    expect(error.message).toContain("at src/features/broken.feature:4:3");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
