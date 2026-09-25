import { Binding, Given } from "../../../src/index.js";

@Binding()
export class NoLoweringMetaSteps {
  @Given("a step that never runs")
  step(): void {}
}
