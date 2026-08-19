import { expect } from "vitest";
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
