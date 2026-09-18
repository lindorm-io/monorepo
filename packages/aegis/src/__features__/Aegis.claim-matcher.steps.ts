import type { DocString } from "@lindorm/gherkin";
import { Binding, Given, Then } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisError } from "../errors/index.js";
import type { VerifyAssert } from "../types/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";

@Binding()
export class AegisClaimMatcherSteps extends AegisStepsBase {
  // what the verifier asserts about the claims

  @Given("the verifier asserts")
  theVerifierAsserts(matcher: DocString): void {
    this.ctx.assert = JSON.parse(matcher.content) as VerifyAssert;
  }

  @Given("the verifier's matcher {string} is left undefined")
  theVerifiersMatcherIsLeftUndefined(key: string): void {
    // An own key holding `undefined`, never an absent key: the sentence states a
    // matcher the verifier wrote and left unset.
    Object.assign((this.ctx.assert ??= {}), { [key]: undefined });
  }

  @Given("the verifier asserts an expiry no later than {string}")
  theVerifierAssertsAnExpiryNoLaterThan(instant: string): void {
    (this.ctx.assert ??= {}).expiresAt = { $lte: new Date(instant) };
  }

  // the temporal window the verifier states

  @Given("the verifier leaves the expiry unchecked")
  theVerifierLeavesTheExpiryUnchecked(): void {
    this.ctx.verifyOptions.verifyExpiration = false;
  }

  @Given("the verifier leaves the not-before instant unchecked")
  theVerifierLeavesTheNotBeforeInstantUnchecked(): void {
    this.ctx.verifyOptions.verifyNotBefore = false;
  }

  @Given("the verifier bounds the authentication time")
  theVerifierBoundsTheAuthenticationTime(): void {
    this.ctx.verifyOptions.verifyAuthTime = true;
  }

  @Given("the verifier allows a clock tolerance of {int} seconds")
  theVerifierAllowsAClockToleranceOf(seconds: number): void {
    this.ctx.verifyOptions.clockTolerance = seconds;
  }

  @Given("the verifier judges the claims at {string}")
  theVerifierJudgesTheClaimsAt(instant: string): void {
    this.ctx.verifyOptions.currentDate = new Date(instant);
  }

  @Given("the verifier allows an age of at most {int} seconds")
  theVerifierAllowsAnAgeOfAtMost(seconds: number): void {
    this.ctx.verifyOptions.maxTokenAge = seconds;
  }

  // the refusals

  @Then("verification is refused as the matcher's own error")
  verificationIsRefusedAsTheMatchersOwnError(): void {
    const refusal = this.refusal();

    expect(refusal).toBeInstanceOf(TypeError);
    expect(refusal).not.toBeInstanceOf(AegisError);
  }

  @Then("the refusal lists the invalid claims {stringList}")
  theRefusalListsTheInvalidClaims(invalid: Array<string>): void {
    expect(this.refusal()).toMatchObject({ data: { invalid } });
  }

  @Then("the refusal names the matcher {string}")
  theRefusalNamesTheMatcher(key: string): void {
    expect(this.refusal()).toMatchObject({ data: { key } });
  }

  @Then("the refusal names the conflicting matchers {stringList}")
  theRefusalNamesTheConflictingMatchers(keys: Array<string>): void {
    expect(this.refusal()).toMatchObject({ data: { keys } });
  }
}
