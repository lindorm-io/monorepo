import { Binding, Given, Then, When } from "@lindorm/gherkin";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Tag } from "cbor2";
import { expect } from "vitest";
import { Aegis } from "../classes/Aegis.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import type { WireKey } from "../__fixtures__/raw-bucket.js";

/** RFC 8949 §3.4.2: the epoch-based date/time tag. */
const EPOCH_DATE_TAG = 1;

@Binding()
export class AegisTemporalPolicySteps extends AegisStepsBase {
  // the deployment

  @Given("the deployment allows a clock tolerance of {int} seconds")
  theDeploymentAllowsAClockToleranceOf(seconds: number): void {
    // A setting is a constructor argument, so the deployment is built again
    // around the vault the feature already stocked. ⚠ The new `Aegis`'s profile
    // registry starts from the built-ins alone (`createProfileRegistry`), so a
    // profile registered earlier in the scenario is lost and the scenario fails
    // `unknown_profile`: a scenario needing both states this step first.
    this.ctx.aegis = new Aegis({
      amphora: this.ctx.amphora,
      logger: createMockLogger(),
      clockTolerance: seconds,
    });
  }

  // the wire claims, stated in the wire's own vocabulary

  @Given("the wire claims state the expiry {string} under the CBOR epoch-based date tag")
  theWireClaimsStateTheExpiryUnderTheEpochBasedDateTag(instant: string): void {
    this.ctx.wireClaims.exp = new Tag(
      EPOCH_DATE_TAG,
      Math.floor(new Date(instant).getTime() / 1000),
    );
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

  // the domain result

  @Then("the verified claims carry {string} as the instant {string}")
  theVerifiedClaimsCarryAsTheInstant(claim: string, instant: string): void {
    expect(this.verified().claims).toHaveProperty(claim, new Date(instant));
  }

  // the raw wire, read off the bytes

  @Then("the raw payload carries {wireKey} as the tagged date {string}")
  theRawPayloadCarriesAsTheTaggedDate(key: WireKey, instant: string): void {
    expect(this.raw("payload").get(key)).toEqual(new Date(instant));
  }
}
