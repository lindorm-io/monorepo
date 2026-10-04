import type { DataTable } from "@lindorm/gherkin";
import { Binding, Then } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { jsonCells } from "../__fixtures__/json-cells.js";

/**
 * The general instrument for the client contract, declared once for every feature
 * file: the step namespace is flat, so one `@Binding()` serves them all. A
 * sentence that already names every member of `data` keeps its own wording — this
 * table is for the bags a sentence cannot state cleanly.
 */
@Binding()
export class AegisRefusalDataSteps extends AegisStepsBase {
  // the refusals

  @Then("the refusal's data is exactly")
  theRefusalsDataIsExactly(table: DataTable): void {
    expect(this.refusalData()).toEqual(jsonCells(table));
  }

  @Then("the refusal carries no data")
  theRefusalCarriesNoData(): void {
    expect(this.refusalData()).toStrictEqual({});
  }
}
