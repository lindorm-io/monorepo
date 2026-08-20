import { LindormError } from "@lindorm/errors";
import { beforeEach, describe, expect, test } from "vitest";
import { z } from "zod";
import { captureAsync, errorShape } from "../../__fixtures__/test-helpers.js";
import { DataTable } from "../../classes/DataTable.js";
import { DocString } from "../../classes/DocString.js";
import { Binding } from "../../decorators/Binding.js";
import { Given } from "../../decorators/Given.js";
import { ParameterType } from "../../decorators/ParameterType.js";
import { When } from "../../decorators/When.js";
import { GherkinError } from "../../errors/GherkinError.js";
import { PendingStepError } from "../../errors/PendingStepError.js";
import { PENDING_STEP_BRAND } from "../metadata/symbols.js";
import type { ScenarioNode, StepModel } from "../model/types.js";
import { buildRegistry } from "../registry/build-registry.js";
import { drainRegistrations } from "../registry/registrations.js";
import { runScenario } from "./run-scenario.js";

const events: Array<string> = [];

@Binding()
class RecordSteps {
  static instances = 0;

  readonly id: number;

  constructor() {
    RecordSteps.instances += 1;
    this.id = RecordSteps.instances;
  }

  @Given("record {string}")
  record(value: string): void {
    events.push(`record:${value}:${this.id}`);
  }

  @Given("a sync throw")
  syncThrow(): void {
    throw new Error("sync boom");
  }

  @Given("an async rejection")
  async asyncRejection(): Promise<void> {
    await Promise.resolve();
    throw new Error("async boom");
  }

  @Given("a sync step returning a rejecting promise")
  syncReturnsRejection(): Promise<void> {
    return Promise.reject(new Error("returned rejection"));
  }

  @Given("a pending step")
  pending(): void {
    throw new PendingStepError();
  }

  @Given("a foreign pending step")
  foreignPending(): void {
    // The dual-install shape: a PendingStepError from a SECOND installed copy
    // of the package — same Symbol.for brand, foreign prototype chain, and a
    // DRIFTED urn (an older copy spelling the code differently). The wrapper
    // must report the canonical urn, never the inner error's.
    const error = new Error("Step is not implemented") as Error & { type: string };
    error.type = "urn:lindorm:gherkin:error:pending";
    Object.defineProperty(error, PENDING_STEP_BRAND, { value: true });
    throw error;
  }

  @Given("a non-error throw")
  nonErrorThrow(): void {
    // eslint-disable-next-line no-throw-literal
    throw "just a string";
  }

  @Given("an assertion failure")
  assertionFailure(): void {
    const error = new Error("expected 'a' to be 'b'") as Error & {
      actual: string;
      expected: string;
    };
    error.name = "AssertionError";
    error.actual = "a";
    error.expected = "b";
    throw error;
  }
}

@Binding()
class OtherSteps {
  static instances = 0;

  constructor() {
    OtherSteps.instances += 1;
  }

  @Given("other record {string}")
  other(value: string): void {
    events.push(`other:${value}`);
  }
}

@Binding()
class ThrowingCtorSteps {
  constructor() {
    throw new Error("ctor boom");
  }

  @Given("needs the throwing constructor")
  needs(): void {}
}

@Binding()
class StringCtorSteps {
  constructor() {
    // eslint-disable-next-line no-throw-literal
    throw "ctor string";
  }

  @Given("needs the string-throwing constructor")
  needs(): void {}
}

const order: Array<string> = [];

@Binding()
class TransformSteps {
  @ParameterType("evens", /\d+/)
  static evens(raw: string): number {
    const value = Number(raw);
    if (value % 2 === 0) {
      return value;
    }
    throw new Error(`odd: ${raw}`);
  }

  @ParameterType("asyncbad", /[a-z]+/)
  static async asyncbad(raw: string): Promise<string> {
    await Promise.resolve();
    throw new Error(`no good: ${raw}`);
  }

  @ParameterType("ordered", /[a-z]+/)
  static async ordered(raw: string): Promise<string> {
    order.push(`start:${raw}`);
    await new Promise((resolve) => setTimeout(resolve, raw === "aa" ? 20 : 1));
    order.push(`end:${raw}`);
    return raw;
  }

  @ParameterType("rawthrow", /[a-z]+/)
  static rawthrow(raw: string): string {
    // eslint-disable-next-line no-throw-literal
    throw `not an error: ${raw}`;
  }

  @ParameterType("foreignbad", /[a-z]+/)
  static foreignbad(raw: string): string {
    // A consumer transform throwing its OWN lindorm urn — the wrapper's type
    // must stay conversion_failed, never the inner error's.
    throw new LindormError(`no such algorithm ${raw}`, {
      code: "unknown_algorithm",
      type: "urn:lindorm:amphora:error:unknown_algorithm",
    });
  }

  @Given("non-error conversion of {rawthrow}")
  nonErrorConversion(_value: string): void {}

  @Given("foreign conversion of {foreignbad}")
  foreignConversion(_value: string): void {}

  @Given("pair {evens} and {asyncbad}")
  pair(_a: number, _b: string): void {
    order.push("body sync throw");
    throw new Error("body sync throw");
  }

  @Given("ordering {ordered} then {ordered}")
  ordering(a: string, b: string): void {
    order.push(`invoke:${a}:${b}`);
  }
}

const PriceSchema = z.object({ name: z.string(), price: z.coerce.number() });

@Binding()
class SlotSteps {
  // Rest parameters expose the INVOCATION arity — the §3.6 stable-arity
  // contract is about what the runner passes, not what a signature declares.
  @Given("a slotless step")
  slotless(...args: Array<unknown>): void {
    events.push(`slot:${args.length}:${String(args[0])}`);
  }

  @Given("a documented step")
  documented(doc: DocString): void {
    events.push(`doc:${doc.content}:${String(doc.mediaType)}`);
  }

  @Given("a labelled {string} table")
  labelledTable(label: string, table: DataTable): void {
    events.push(`table:${label}:${JSON.stringify(table.hashes())}`);
  }

  @Given("a converting step")
  converting(table: DataTable): void {
    events.push(`converted:${JSON.stringify(table.createSet(PriceSchema))}`);
  }
}

@Binding()
class AmbiguousGiven {
  @Given("a duplicated step")
  given(): void {}
}

@Binding()
class AmbiguousWhen {
  @When("a duplicated step")
  when(): void {}
}

const registry = buildRegistry([
  { modulePath: "src/run.steps.ts", registrations: drainRegistrations() },
]);

const uri = "src/features/run.feature";

const step = (text: string, overrides: Partial<StepModel> = {}): StepModel => ({
  column: 5,
  line: 10,
  text,
  type: "Context",
  ...overrides,
});

const scenario = (steps: Array<StepModel>): ScenarioNode => ({
  kind: "scenario",
  column: 3,
  line: 3,
  name: "scenario under test",
  steps,
  tags: [],
});

const run = (steps: Array<StepModel>): Promise<void> =>
  runScenario({ featureName: "run feature", registry, scenario: scenario(steps), uri });

describe("runScenario", () => {
  beforeEach(() => {
    events.length = 0;
    order.length = 0;
    RecordSteps.instances = 0;
    OtherSteps.instances = 0;
  });

  describe("execution", () => {
    test("should run steps sequentially against ONE instance per class", async () => {
      await run([step('record "one"'), step('record "two"')]);

      expect(events).toEqual(["record:one:1", "record:two:1"]);
      expect(RecordSteps.instances).toBe(1);
    });

    test("should construct a FRESH instance for every scenario", async () => {
      await run([step('record "first scenario"')]);
      await run([step('record "second scenario"')]);

      expect(events).toEqual(["record:first scenario:1", "record:second scenario:2"]);
      expect(RecordSteps.instances).toBe(2);
    });

    test("should construct one instance per class within a scenario", async () => {
      await run([step('record "a"'), step('other record "b"'), step('record "c"')]);

      expect(events).toEqual(["record:a:1", "other:b", "record:c:1"]);
      expect(RecordSteps.instances).toBe(1);
      expect(OtherSteps.instances).toBe(1);
    });

    test("should NOT construct a class no step matched into", async () => {
      await run([step('other record "solo"')]);

      expect(RecordSteps.instances).toBe(0);
      expect(OtherSteps.instances).toBe(1);
    });
  });

  describe("argument handling", () => {
    test("should await each argument in order, all before the step is invoked", async () => {
      await run([step("ordering aa then bb")]);

      expect(order).toEqual(["start:aa", "end:aa", "start:bb", "end:bb", "invoke:aa:bb"]);
    });

    test("should report conversion_failed for a throwing sync transform", async () => {
      const error = await captureAsync(() =>
        run([step("pair 3 and abc"), step('record "next"')]),
      );

      expect(error).toBeInstanceOf(GherkinError);
      expect(error.code).toBe("conversion_failed");
      expect(error.message).toContain('Parameter {evens} could not convert "3"');
      expect(error.message).toContain("odd: 3");
      expect(error.message).toContain("at src/features/run.feature:10:5");
      expect(error.message).toContain(
        "The remaining 1 step in this scenario was skipped.",
      );
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should report conversion_failed for a rejected async transform even when the step body would throw", async () => {
      const error = await captureAsync(() => run([step("pair 4 and abc")]));

      expect(error.code).toBe("conversion_failed");
      expect(error.message).toContain('Parameter {asyncbad} could not convert "abc"');
      expect(error.message).toContain("no good: abc");
      // The ORDER rule: the step body never ran, so its failure never surfaced.
      expect(error.message).not.toContain("body sync throw");
      expect(order).not.toContain("body sync throw");
    });

    test("should report a non-Error transform throw as conversion_failed with its string form", async () => {
      const error = await captureAsync(() => run([step("non-error conversion of abc")]));

      expect(error.code).toBe("conversion_failed");
      expect(error.message).toContain('Parameter {rawthrow} could not convert "abc"');
      expect(error.message).toContain("not an error: abc");
    });

    test("should anchor a custom transform's conversion failure to its declaration", async () => {
      const error = await captureAsync(() => run([step("pair 3 and abc")]));

      expect(error.message).toContain("TransformSteps.evens (src/run.steps.ts)");
    });

    test("should keep the conversion_failed urn when a transform throws a FOREIGN LindormError", async () => {
      const error = await captureAsync(() => run([step("foreign conversion of xyz")]));

      // Without the wrapper's explicit type, the inner error's own urn wins
      // (LindormError inner-type precedence) and the taxonomy lies.
      expect(error.code).toBe("conversion_failed");
      expect(error.type).toBe("urn:lindorm:gherkin:error:conversion_failed");
      // The original still travels through the lineage.
      expect(error.errors).toContain("LindormError: no such algorithm xyz");
      expect(error.message).toContain("no such algorithm xyz");
    });
  });

  describe("trailing argument slot", () => {
    test("should ALWAYS pass the slot — undefined at stable arity when the step carries none", async () => {
      // §3.6: filtering an absent slot out shifts every parameter's position
      // (the @amiceli arity bug). The invocation must carry exactly one
      // argument here: the undefined slot.
      await run([step("a slotless step")]);

      expect(events).toEqual(["slot:1:undefined"]);
    });

    test("should deliver a DocString with content and media type", async () => {
      await run([
        step("a documented step", {
          argument: { kind: "doc-string", content: "payload body", mediaType: "json" },
        }),
      ]);

      expect(events).toEqual(["doc:payload body:json"]);
    });

    test("should deliver a DataTable AFTER the converted expression parameters", async () => {
      await run([
        step('a labelled "prices" table', {
          argument: {
            kind: "data-table",
            rows: [
              ["name", "price"],
              ["apple", "3"],
            ],
          },
        }),
      ]);

      expect(events).toEqual(['table:prices:[{"name":"apple","price":"3"}]']);
    });

    test("should anchor a table_conversion_failed thrown in the step body to the step", async () => {
      const error = await captureAsync(() =>
        run([
          step("a converting step", {
            argument: {
              kind: "data-table",
              rows: [
                ["name", "price"],
                ["apple", "oops"],
              ],
            },
          }),
        ]),
      );

      // The step-failure path prepends the anchor; the wrapper's own message
      // (row + zod issues) survives inside it.
      expect(error.code).toBe("table_conversion_failed");
      expect(error.message).toContain("at src/features/run.feature:10:5");
      expect(error.message).toContain("Data table body row 1 failed schema conversion");
      expect(error.message).toContain("Invalid input: expected number, received NaN");
    });
  });

  describe("failure modes", () => {
    test("should report an UNDEFINED argument-bearing step with a table-typed snippet", async () => {
      // The M1 guard is gone: dispatch decides on the text alone, so an
      // unmatched table step is an ordinary undefined_step — and its snippet
      // declares the trailing parameter.
      const error = await captureAsync(() =>
        run([
          step("a table nobody defined", {
            argument: { kind: "data-table", rows: [["a"], ["1"]] },
          }),
          step('record "x"'),
        ]),
      );

      expect(error.code).toBe("undefined_step");
      expect(error.message).toContain(
        "aTableNobodyDefined(dataTable: DataTable): void {",
      );
      expect(error.message).toContain(
        "The remaining 1 step in this scenario was skipped.",
      );
      expect(events).toEqual([]);
    });

    test("should fail an undefined step with a pasteable snippet", async () => {
      const error = await captureAsync(() =>
        run([
          step('I encrypt "secret" in record mode with aad "tenant-1"', {
            line: 12,
            type: "Action",
          }),
          step('record "a"'),
          step('record "b"'),
        ]),
      );

      expect(error.code).toBe("undefined_step");
      expect(error.message).toContain("Undefined step");
      expect(error.message).toContain("at src/features/run.feature:12:5");
      expect(error.message).toContain(
        '@When("I encrypt {string} in record mode with aad {string}")',
      );
      expect(error.message).toContain("throw new PendingStepError();");
      expect(error.message).toContain(
        "The remaining 2 steps in this scenario were skipped.",
      );
      expect(events).toEqual([]);
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should fail an ambiguous step listing every candidate", async () => {
      const error = await captureAsync(() => run([step("a duplicated step")]));

      expect(error.code).toBe("ambiguous_step");
      expect(error.message).toContain("2 step definitions matched:");
      expect(error.message).toContain("AmbiguousGiven.given");
      expect(error.message).toContain("AmbiguousWhen.when");
      expect(error.message).not.toContain("skipped");
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should fail a pending step naming the class.method", async () => {
      const error = await captureAsync(() => run([step("a pending step")]));

      expect(error.code).toBe("pending_step");
      expect(error.message).toContain("Pending step");
      expect(error.message).toContain(
        "RecordSteps.pending is pending — implement its body.",
      );
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should detect a branded pending error from a second installed package copy", async () => {
      const error = await captureAsync(() => run([step("a foreign pending step")]));

      expect(error.code).toBe("pending_step");
      // The CANONICAL urn even though the foreign copy carries a drifted one —
      // the explicit type option, never the inner error's precedence.
      expect(error.type).toBe("urn:lindorm:gherkin:error:pending_step");
      expect(error.message).toContain("Pending step");
      expect(error.message).toContain(
        "RecordSteps.foreignPending is pending — implement its body.",
      );
    });

    test("should rethrow a sync step failure as the ORIGINAL error with the anchor prepended", async () => {
      const error = await captureAsync(() =>
        run([step("a sync throw"), step('record "never"')]),
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(GherkinError);
      expect(error.message).toContain("Step failed");
      expect(error.message).toContain("  Given a sync throw");
      expect(error.message).toContain("sync boom");
      expect(error.message).toContain(
        "The remaining 1 step in this scenario was skipped.",
      );
      expect(events).toEqual([]);
    });

    test("should preserve an assertion error's instance, actual and expected through the wrap", async () => {
      const error = (await captureAsync(() =>
        run([step("an assertion failure")]),
      )) as GherkinError & { actual?: string; expected?: string };

      // The same instance is rethrown — vitest reads actual/expected off it
      // to print the expect() diff, so wrapping in a new error would lose it.
      expect(error.name).toBe("AssertionError");
      expect(error.actual).toBe("a");
      expect(error.expected).toBe("b");
      expect(error.message).toContain("Step failed");
      expect(error.message).toContain("expected 'a' to be 'b'");
    });

    test("should fail the scenario when an async step rejects after a tick", async () => {
      const error = await captureAsync(() => run([step("an async rejection")]));

      expect(error.message).toContain("Step failed");
      expect(error.message).toContain("async boom");
    });

    test("should fail the scenario when a sync step returns a rejecting promise", async () => {
      const error = await captureAsync(() =>
        run([step("a sync step returning a rejecting promise")]),
      );

      expect(error.message).toContain("Step failed");
      expect(error.message).toContain("returned rejection");
    });

    test("should wrap a non-Error throw into an Error carrying the anchor", async () => {
      const error = await captureAsync(() => run([step("a non-error throw")]));

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("Step failed");
      expect(error.message).toContain("just a string");
    });

    test("should fail the scenario when the binding constructor throws, anchored to the class", async () => {
      const error = await captureAsync(() =>
        run([step("needs the throwing constructor"), step('record "never"')]),
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain(
        "Binding class ThrowingCtorSteps constructor threw",
      );
      expect(error.message).toContain("ctor boom");
      expect(error.message).toContain(
        "The remaining 1 step in this scenario was skipped.",
      );
      expect(events).toEqual([]);
    });

    test("should wrap a non-Error constructor throw into an Error", async () => {
      const error = await captureAsync(() =>
        run([step("needs the string-throwing constructor")]),
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("Binding class StringCtorSteps constructor threw");
      expect(error.message).toContain("ctor string");
    });

    test("should skip remaining steps after the first failure — they never execute", async () => {
      const error = await captureAsync(() =>
        run([step('record "ran"'), step("a sync throw"), step('record "after"')]),
      );

      expect(error.message).toContain(
        "The remaining 1 step in this scenario was skipped.",
      );
      expect(events).toEqual(["record:ran:1"]);
    });

    test("should omit the skipped line when the LAST step fails", async () => {
      const error = await captureAsync(() =>
        run([step('record "ran"'), step("a sync throw")]),
      );

      expect(error.message).not.toContain("skipped");
    });
  });
});
