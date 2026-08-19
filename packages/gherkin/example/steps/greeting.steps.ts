import { expect } from "vitest";
// In a consuming package: import { … } from "@lindorm/gherkin";
import { Binding, Given, ParameterType, Then, When } from "../../src/index.js";

type Volume = (value: string) => string;

@Binding()
export class GreetingSteps {
  private greeting!: string;
  private result!: string;

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
