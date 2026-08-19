import { expect } from "vitest";
// In a consuming package: import { … } from "@lindorm/gherkin";
import type { StepInfo, StepResult } from "../../src/index.js";
import {
  AfterStep,
  Binding,
  Context,
  Given,
  Inject,
  ParameterType,
  Then,
  When,
} from "../../src/index.js";

type Volume = (value: string) => string;

// One instance per scenario, shared by every class that injects it, disposed
// after the scenario.
@Context()
export class GreetingBook {
  entries: Array<string> = [];
}

@Binding()
export class GreetingSteps {
  @Inject(GreetingBook)
  private readonly book!: GreetingBook;

  private greeting!: string;
  private result!: string;

  @AfterStep()
  record(step: StepInfo, result: StepResult): void {
    this.book.entries.push(`${step.text}: ${result.status}`);
  }

  @Then("the book has recorded {int} steps")
  theBookHasRecorded(count: number): void {
    expect(this.book.entries).toHaveLength(count);
  }

  @Given("the greeting {string}")
  theGreeting(greeting: string): void {
    this.greeting = greeting;
  }

  @When("I greet {string}")
  iGreet(name: string): void {
    this.result = `${this.greeting}, ${name}!`;
  }

  // {volume} is the custom parameter type declared below — the step receives
  // the TRANSFORMED value, not the matched text.
  @When("I greet {string} {volume}")
  iGreetWithVolume(name: string, volume: Volume): void {
    this.result = `${this.greeting}, ${volume(name)}!`;
  }

  @Then("the result is {string}")
  theResultIs(expected: string): void {
    expect(this.result).toBe(expected);
  }

  @ParameterType("volume", /shouting|whispering/)
  static volume(raw: string): Volume {
    return raw === "shouting"
      ? (value): string => value.toUpperCase()
      : (value): string => value.toLowerCase();
  }
}
