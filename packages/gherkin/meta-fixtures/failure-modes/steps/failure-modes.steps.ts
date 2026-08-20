import { expect } from "vitest";
import { z } from "zod";
import type { DataTable, DocString } from "../../../src/index.js";
import {
  Binding,
  Given,
  ParameterType,
  PendingStepError,
  Then,
  When,
} from "../../../src/index.js";

/**
 * The child's stdout is the meta-suite's oracle: a sentinel line proves a
 * step body RAN, its absence proves the body never ran. The rejected-transform
 * scenario asserts ABSENCE (arguments are awaited before the step is
 * invoked); the resolved-transform scenario asserts PRESENCE (the control
 * that proves the sentinel channel can fire at all).
 */
const sentinel = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

@Binding()
export class DuplicatedAlpha {
  @Given("a duplicated step")
  aDuplicatedStep(): void {}
}

@Binding()
export class DuplicatedBeta {
  // @When on purpose — matching is text-only, so the keyword must NOT
  // disambiguate, and the reporter must render the decorator as authored.
  @When("a duplicated step")
  alsoADuplicatedStep(): void {}
}

@Binding()
export class PendingSteps {
  @Given("a pending step")
  aPendingStep(): void {
    throw new PendingStepError();
  }
}

@Binding()
export class ConversionSteps {
  @Given('a failing value "{failing}"')
  aFailingValue(_value: string): void {
    sentinel("META_SENTINEL_FAILING_BODY_RAN");
  }

  @Given('a rejecting value "{rejecting}"')
  aRejectingValue(_value: string): void {
    sentinel("META_SENTINEL_REJECTING_BODY_RAN");
  }

  @Given('an upper value "{upper}"')
  anUpperValue(value: string): void {
    sentinel(`META_SENTINEL_CONVERTED_${value}`);
    expect(value).toBe("FINE");
  }

  @ParameterType("failing", /[a-z]+/)
  static failing(raw: string): string {
    throw new Error(`no such value "${raw}"`);
  }

  @ParameterType("rejecting", /[a-z]+/)
  static async rejecting(raw: string): Promise<string> {
    await Promise.resolve();
    throw new Error(`rejected value "${raw}"`);
  }

  @ParameterType("upper", /[a-z]+/)
  static async upper(raw: string): Promise<string> {
    await Promise.resolve();
    return raw.toUpperCase();
  }
}

@Binding()
export class ThrowingConstructorSteps {
  constructor() {
    throw new Error("no fixture store configured");
  }

  @Given("a step in a throwing class")
  aStepInAThrowingClass(): void {}

  @Then("another step in the throwing class")
  anotherStepInTheThrowingClass(): void {}
}

@Binding()
export class AsyncSteps {
  @When("an async step rejects after a tick")
  async anAsyncStepRejects(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1));
    throw new Error("rejected after a tick");
  }
}

const PriceSchema = z.object({ name: z.string(), price: z.coerce.number() });

const AsyncSchema = z.object({ name: z.string().refine(async () => true) });

@Binding()
export class DataDeliverySteps {
  // Rest parameters expose the INVOCATION arity — the §3.6 stable-arity
  // proof: the runner passes the trailing slot unconditionally, undefined
  // when the step carries no argument.
  @Given("a slotless sentinel step")
  slotless(...args: Array<unknown>): void {
    sentinel(`META_SENTINEL_SLOT_${args.length}_${String(args[0])}`);
  }

  @Given("a documented payload")
  documented(doc: DocString): void {
    sentinel(`META_SENTINEL_DOC_${doc.mediaType}_${doc.content.split("\n").join("|")}`);
  }

  @Given("a typed catalog")
  typedCatalog(table: DataTable): void {
    // Unquoted prices in the JSON prove zod coerced strings to numbers.
    sentinel(`META_SENTINEL_SET_${JSON.stringify(table.createSet(PriceSchema))}`);
  }

  @Given("a typed product")
  typedProduct(table: DataTable): void {
    sentinel(`META_SENTINEL_CREATE_${JSON.stringify(table.create(PriceSchema))}`);
  }

  @Given("a sentinel table")
  sentinelTable(table: DataTable): void {
    sentinel(`META_SENTINEL_CELL_${table.rows()[0][0]}`);
  }
}

@Binding()
export class DataConversionSteps {
  // Each body prints its CONTINUED sentinel AFTER the conversion call — its
  // absence proves the throw stopped the body, its counterpart's presence in
  // data-delivery proves the sentinel channel fires.
  @Given("an async schema parsed synchronously")
  asyncParsedSync(table: DataTable): void {
    table.createSet(AsyncSchema);
    sentinel("META_SENTINEL_ASYNC_SCHEMA_CONTINUED");
  }

  @Given("a violating catalog")
  violating(table: DataTable): void {
    table.createSet(PriceSchema);
    sentinel("META_SENTINEL_VIOLATING_CONTINUED");
  }

  @Given("a created product")
  createdProduct(table: DataTable): void {
    table.create(PriceSchema);
    sentinel("META_SENTINEL_CREATE_MULTI_CONTINUED");
  }
}

@Binding()
export class GreenSteps {
  private counter!: number;

  @Given("a counter starting at {string}")
  aCounterStartingAt(start: string): void {
    this.counter = Number(start);
  }

  @When("I bump the counter by {string}")
  iBumpTheCounterBy(bump: string): void {
    this.counter += Number(bump);
  }

  @Then("the counter reads {string}")
  theCounterReads(total: string): void {
    expect(this.counter).toBe(Number(total));
  }
}
