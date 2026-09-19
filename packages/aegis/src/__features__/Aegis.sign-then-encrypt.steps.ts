import { Binding, Then } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";

@Binding()
export class AegisSignThenEncryptSteps extends AegisStepsBase {
  // the minted result

  @Then("the minted token is a {string}")
  theMintedTokenIsA(format: string): void {
    expect(this.signed().format).toBe(format);
  }

  @Then("the minted token reports the wrapper {string}")
  theMintedTokenReportsTheWrapper(wrapper: string): void {
    expect(this.signed().wrapper).toBe(wrapper);
  }
}
