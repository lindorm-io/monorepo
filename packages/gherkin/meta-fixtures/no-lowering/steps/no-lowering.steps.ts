import { Binding, Given, Then } from "../../../src/index.js";

@Binding()
export class NoLoweringMetaSteps {
  @Given("a step that never runs")
  step(): void {}

  @Then("the step module never loads")
  neverLoads(): void {
    throw new Error("a step module left with its decorators must never load");
  }
}
