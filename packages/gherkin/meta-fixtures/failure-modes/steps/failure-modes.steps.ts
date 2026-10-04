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
export class StoppedScenarioSteps {
  @Then("the scenario stops before this step")
  stopsBefore(): void {
    expect.unreachable("the failing step above must stop the scenario");
  }
}

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
export class GadgetSteps {
  @Given("a gadget on the bench")
  aGadgetOnTheBench(): void {}
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
  private upperValue = "";

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
    this.upperValue = value;
  }

  @Then("the upper value reads {string}")
  theUpperValueReads(expected: string): void {
    expect(this.upperValue).toBe(expected);
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
export class UncheckedSteps {
  @Given("an unchecked situation")
  situation(): void {
    sentinel("META_SENTINEL_INCOMPLETE_STEP_RAN");
  }

  @When("an unchecked action")
  action(): void {
    sentinel("META_SENTINEL_INCOMPLETE_STEP_RAN");
  }

  @Then("an unchecked outcome")
  outcome(): void {
    sentinel("META_SENTINEL_INCOMPLETE_STEP_RAN");
  }
}

@Binding()
export class AsyncSteps {
  private tickMs = 0;

  @Given("a tick of {int} ms")
  aTick(ms: number): void {
    this.tickMs = ms;
  }

  @When("an async step rejects after a tick")
  async anAsyncStepRejects(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.tickMs));
    throw new Error("rejected after a tick");
  }
}

const PriceSchema = z.object({ name: z.string(), price: z.coerce.number() });

type Price = z.infer<typeof PriceSchema>;

const AsyncSchema = z.object({ name: z.string().refine(async () => true) });

@Binding()
export class DataDeliverySteps {
  private slotArgs: Array<unknown> = [];
  private mediaType: string | undefined;
  private catalog: Array<Price> = [];
  private product: Price | undefined;
  private cell = "";

  // Rest parameters expose the INVOCATION arity — the §3.6 stable-arity
  // proof: the runner passes the trailing slot unconditionally, undefined
  // when the step carries no argument.
  @Given("a slotless sentinel step")
  slotless(...args: Array<unknown>): void {
    sentinel(`META_SENTINEL_SLOT_${args.length}_${String(args[0])}`);
    this.slotArgs = args;
  }

  @Then("the step saw one undefined slot")
  sawOneUndefinedSlot(): void {
    expect(this.slotArgs).toEqual([undefined]);
  }

  @Given("a documented payload")
  documented(doc: DocString): void {
    sentinel(`META_SENTINEL_DOC_${doc.mediaType}_${doc.content.split("\n").join("|")}`);
    this.mediaType = doc.mediaType;
  }

  @Then("the payload arrived as {string}")
  payloadArrivedAs(mediaType: string): void {
    expect(this.mediaType).toBe(mediaType);
  }

  @Given("a typed catalog")
  typedCatalog(table: DataTable): void {
    this.catalog = table.createSet(PriceSchema);
    // Unquoted prices in the JSON prove zod coerced strings to numbers.
    sentinel(`META_SENTINEL_SET_${JSON.stringify(this.catalog)}`);
  }

  @Then("the total price is {string}")
  totalPriceIs(total: string): void {
    expect(this.catalog.reduce((sum, entry) => sum + entry.price, 0)).toBe(Number(total));
  }

  @Given("a typed product")
  typedProduct(table: DataTable): void {
    this.product = table.create(PriceSchema);
    sentinel(`META_SENTINEL_CREATE_${JSON.stringify(this.product)}`);
  }

  @Then("the product costs {string}")
  productCosts(price: string): void {
    expect(this.product?.price).toBe(Number(price));
  }

  @Given("a sentinel table")
  sentinelTable(table: DataTable): void {
    this.cell = table.rows()[0][0];
    sentinel(`META_SENTINEL_CELL_${this.cell}`);
  }

  @Then("the cell reads {string}")
  cellReads(value: string): void {
    expect(this.cell).toBe(value);
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
