import { Binding, Then } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";

@Binding()
export class AegisSensitiveClaimConfidentialitySteps extends AegisStepsBase {
  // the minted result

  @Then("the minted token reports no wrapper")
  theMintedTokenReportsNoWrapper(): void {
    expect(this.signed()).not.toHaveProperty("wrapper");
  }
}
