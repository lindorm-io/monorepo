import { Binding, Then } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";

@Binding()
export class AegisIssuerPinSteps extends AegisStepsBase {
  // the refusals

  @Then("the refusal names the issuer {string}")
  theRefusalNamesTheIssuer(issuer: string): void {
    expect(this.refusal()).toMatchObject({ data: { issuer } });
  }
}
