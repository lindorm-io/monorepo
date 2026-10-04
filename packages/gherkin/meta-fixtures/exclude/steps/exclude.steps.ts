import { expect } from "vitest";
import { Binding, Given, Then } from "../../../src/index.js";

@Binding()
export class ExcludeSteps {
  private collectedRan = false;

  @Given("a collected feature runs")
  runs(): void {
    this.collectedRan = true;
  }

  @Then("the collected feature ran")
  ran(): void {
    expect(this.collectedRan).toBe(true);
  }
}
