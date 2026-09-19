import { Binding, Then, When } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisError } from "../errors/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";

@Binding()
export class AegisErrorContractSteps extends AegisStepsBase {
  // the acts

  @When("I verify the token stating no options")
  async iVerifyTheTokenStatingNoOptions(): Promise<void> {
    const token = this.token();

    this.ctx.verified = await this.attempt(() => this.ctx.aegis.verify(token));
  }

  // the refusals

  @Then("verification is refused as an aegis error")
  verificationIsRefusedAsAnAegisError(): void {
    expect(this.refusal()).toBeInstanceOf(AegisError);
  }

  @Then("the claims are refused as an aegis error")
  theClaimsAreRefusedAsAnAegisError(): void {
    expect(this.refusal()).toBeInstanceOf(AegisError);
    expect(this.ctx.matched, "the boolean door answered true for refused claims").toBe(
      false,
    );
  }
}
