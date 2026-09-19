import type { DataTable } from "@lindorm/gherkin";
import { Binding, Then } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { jsonCells } from "../__fixtures__/json-cells.js";

@Binding()
export class AegisKeylessReadSteps extends AegisStepsBase {
  // the keyless result

  @Then("the parsed token is a {string}")
  theParsedTokenIsA(format: string): void {
    expect(this.parsed().format).toBe(format);
  }

  @Then("the parsed header includes")
  theParsedHeaderIncludes(table: DataTable): void {
    expect(this.parsed().header).toMatchObject(jsonCells(table));
  }

  @Then("the parsed claims include")
  theParsedClaimsInclude(table: DataTable): void {
    expect(this.parsed().claims).toMatchObject(table.rowsHash());
  }

  @Then("the parsed token carries no sensitive bucket")
  theParsedTokenCarriesNoSensitiveBucket(): void {
    expect(this.parsed().sensitive).toBeUndefined();
  }

  @Then("the parsed claims carry no {string}")
  theParsedClaimsCarryNo(name: string): void {
    expect(this.parsed().claims).not.toHaveProperty(name);
  }

  @Then("the parsed custom bucket carries no {string}")
  theParsedCustomBucketCarriesNo(name: string): void {
    expect(this.parsed().custom).not.toHaveProperty(name);
  }
}
