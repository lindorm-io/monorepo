import {
  ParameterType as CucumberParameterType,
  ParameterTypeRegistry,
} from "@cucumber/cucumber-expressions";
import { describe, expect, test } from "vitest";
import type { StepModel } from "../../model/types.js";
import { generateSnippet } from "./generate-snippet.js";

const step = (text: string, type: StepModel["type"] = "Action"): StepModel => ({
  column: 5,
  line: 12,
  text,
  type,
});

describe("generateSnippet", () => {
  test("should emit a pasteable snippet for a two-string step", () => {
    const snippet = generateSnippet(
      step('I encrypt "secret" in record mode with aad "tenant-1"'),
      new ParameterTypeRegistry(),
    );

    expect(snippet).toContain(
      '@When("I encrypt {string} in record mode with aad {string}")',
    );
    expect(snippet).toContain(
      "iEncryptInRecordModeWithAad(string: string, string2: string): void {",
    );
    expect(snippet).toContain("throw new PendingStepError();");
    expect(snippet).toMatchSnapshot();
  });

  test("should type int and float parameters as number", () => {
    const snippet = generateSnippet(
      step("I retry 3 times within 1.5 seconds"),
      new ParameterTypeRegistry(),
    );

    expect(snippet).toContain("{int}");
    expect(snippet).toContain("{float}");
    expect(snippet).toContain("int: number");
    expect(snippet).toContain("float: number");
    expect(snippet).toMatchSnapshot();
  });

  test("should include an opted-in custom parameter type as unknown", () => {
    const registry = new ParameterTypeRegistry();
    registry.defineParameterType(
      new CucumberParameterType<unknown>(
        "encryption",
        /A128GCM|A256GCM/,
        null,
        (raw) => raw,
        true,
        false,
      ),
    );

    const snippet = generateSnippet(
      step("an oct key with encryption A256GCM", "Context"),
      registry,
    );

    expect(snippet).toContain('@Given("an oct key with encryption {encryption}")');
    expect(snippet).toContain("encryption: unknown");
    expect(snippet).toMatchSnapshot();
  });

  test("should emit @Given for an Unknown step type", () => {
    const snippet = generateSnippet(
      step("a wildcard happens", "Unknown"),
      new ParameterTypeRegistry(),
    );

    expect(snippet).toContain('@Given("a wildcard happens")');
    expect(snippet).toContain("aWildcardHappens(): void {");
    expect(snippet).toMatchSnapshot();
  });

  test("should append a typed dataTable parameter for a table-bearing step", () => {
    const snippet = generateSnippet(
      { ...step('I load "prices"'), argument: { kind: "data-table", rows: [["a"]] } },
      new ParameterTypeRegistry(),
    );

    // AFTER the generated expression parameters — the runner appends the
    // slot after every converted parameter.
    expect(snippet).toContain("iLoad(string: string, dataTable: DataTable): void {");
    expect(snippet).toMatchSnapshot();
  });

  test("should append a typed docString parameter for a DocString-bearing step", () => {
    const snippet = generateSnippet(
      { ...step("I note the payload"), argument: { kind: "doc-string", content: "x" } },
      new ParameterTypeRegistry(),
    );

    expect(snippet).toContain("iNoteThePayload(docString: DocString): void {");
    expect(snippet).toMatchSnapshot();
  });
});
