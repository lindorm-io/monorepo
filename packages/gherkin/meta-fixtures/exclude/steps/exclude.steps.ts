import { Binding, Given } from "../../../src/index.js";

@Binding()
export class ExcludeSteps {
  @Given("a collected feature runs")
  runs(): void {}
}
