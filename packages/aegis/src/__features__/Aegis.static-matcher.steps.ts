import type { DataTable } from "@lindorm/gherkin";
import { Binding, Given, Then, When } from "@lindorm/gherkin";
import { expect } from "vitest";
import { Aegis } from "../classes/Aegis.js";
import type { VerifyAssert } from "../types/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { jsonCells } from "../__fixtures__/json-cells.js";

@Binding()
export class AegisStaticMatcherSteps extends AegisStepsBase {
  // the claim set, stated in the domain vocabulary

  @Given("the claims to check")
  theClaimsToCheck(table: DataTable): void {
    this.ctx.claims = jsonCells(table);
  }

  @Given("the claims are not valid before {string}")
  theClaimsAreNotValidBefore(instant: string): void {
    this.ctx.claims.notBefore = new Date(instant);
  }

  @Given("the claims were issued at {string}")
  theClaimsWereIssuedAt(instant: string): void {
    this.ctx.claims.issuedAt = new Date(instant);
  }

  @Given("the claims record the authentication at {string}")
  theClaimsRecordTheAuthenticationAt(instant: string): void {
    this.ctx.claims.authTime = new Date(instant);
  }

  // the act

  @When("I check the claims without a signature")
  async iCheckTheClaimsWithoutASignature(): Promise<void> {
    const { claims, verifyOptions } = this.ctx;
    const assert = this.stated();

    // Both forms of the door answer the same question: the boolean one is read
    // here, the throwing one is left for a Then to judge.
    this.ctx.matched = Aegis.matches(claims, assert, verifyOptions);

    await this.attempt(async () => Aegis.assert(claims, assert, verifyOptions));
  }

  // the verdicts

  @Then("the claims are accepted")
  theClaimsAreAccepted(): void {
    if (this.ctx.refusal !== undefined) {
      throw new Error("the claims were refused", { cause: this.ctx.refusal });
    }

    expect(this.matched(), "the boolean door answered false for accepted claims").toBe(
      true,
    );
  }

  @Then("the claims are refused as a domain error {string}")
  theClaimsAreRefusedAsADomainError(code: string): void {
    this.refusedAsADomainError(code);

    expect(this.matched(), "the boolean door answered true for refused claims").toBe(
      false,
    );
  }

  // helpers

  /** The matcher the scenario stated; an empty one would constrain nothing and pass vacuously. */
  private stated(): VerifyAssert {
    if (this.ctx.assert !== undefined) return this.ctx.assert;

    throw new Error("no matcher was stated in this scenario");
  }

  private matched(): boolean {
    if (this.ctx.matched !== undefined) return this.ctx.matched;

    throw new Error("the claims were not checked in this scenario");
  }
}
