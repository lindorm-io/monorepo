import { Binding, DataTable, Then } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { jsonCells } from "../__fixtures__/json-cells.js";

/** The cell for a member the refusal carries with no value; no JSON value spells it. */
const NO_VALUE = "undefined";

/** The bag a table states: its JSON cells, and a member under {@link NO_VALUE} with no value. */
const statedData = (table: DataTable): Dict => {
  const cells = Object.entries(table.rowsHash());
  const valued = new DataTable(cells.filter(([, cell]) => cell !== NO_VALUE));
  const valueless = cells
    .filter(([, cell]) => cell === NO_VALUE)
    .map(([member]) => [member, undefined]);

  return { ...jsonCells(valued), ...Object.fromEntries(valueless) };
};

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
    expect(this.refusalData()).toStrictEqual(statedData(table));
  }

  @Then("the refusal carries no data")
  theRefusalCarriesNoData(): void {
    expect(this.refusalData()).toStrictEqual({});
  }

  @Then("the refusal's message is: {}")
  theRefusalsMessageIs(message: string): void {
    const refusal = this.refusal();

    expect(refusal).toBeInstanceOf(Error);
    expect((refusal as Error).message).toBe(message);
  }
}
