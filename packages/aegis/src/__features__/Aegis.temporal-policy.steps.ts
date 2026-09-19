import { Binding, Given, When } from "@lindorm/gherkin";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Aegis } from "../classes/Aegis.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";

@Binding()
export class AegisTemporalPolicySteps extends AegisStepsBase {
  // the deployment

  @Given("the deployment allows a clock tolerance of {int} seconds")
  theDeploymentAllowsAClockToleranceOf(seconds: number): void {
    // A setting is a constructor argument, so the deployment is built again
    // around the vault the feature already stocked.
    this.ctx.aegis = new Aegis({
      amphora: this.ctx.amphora,
      logger: createMockLogger(),
      clockTolerance: seconds,
    });
  }

  // the acts

  @When("I verify the token with an empty option bag")
  async iVerifyTheTokenWithAnEmptyOptionBag(): Promise<void> {
    const token = this.token();

    if (Object.keys(this.ctx.verifyOptions).length > 0) {
      throw new Error(
        "the scenario states verify options, so the bag it hands over is not empty",
      );
    }

    this.ctx.verified = await this.attempt(() =>
      this.ctx.aegis.verify(token, undefined, {}),
    );
  }
}
