import type { DataTable, DocString } from "@lindorm/gherkin";
import { Binding, Given, Then, When } from "@lindorm/gherkin";
import { expect } from "vitest";
import type { IAegis } from "../interfaces/index.js";
import type { DomainAssert, VerifyAssert } from "../types/index.js";
import { assertClaims, claimsMatch } from "../utils/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { jsonCells } from "../__fixtures__/json-cells.js";

@Binding()
export class AegisClaimCheckSteps extends AegisStepsBase {
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

  // the acts

  @When("I check the claims without a signature")
  async iCheckTheClaimsWithoutASignature(): Promise<void> {
    const { claims, verifyOptions } = this.ctx;
    const assert = this.stated();
    const aegis = this.deployment();

    // Both forms of the door answer the same question: the boolean one is read
    // here, the throwing one is left for a Then to judge.
    this.ctx.matched = aegis.matches(claims, assert, verifyOptions);

    await this.attempt(async () => aegis.assert(claims, assert, verifyOptions));
  }

  @When("I check the claims without a signature or a deployment")
  async iCheckTheClaimsWithoutASignatureOrADeployment(): Promise<void> {
    const { claims, verifyOptions } = this.ctx;
    const assert = this.stated();

    this.ctx.matched = claimsMatch(claims, assert, verifyOptions);

    await this.attempt(async () => assertClaims(claims, assert, verifyOptions));
  }

  @When("I check the verified claims without a signature, asserting")
  async iCheckTheVerifiedClaimsWithoutASignature(matcher: DocString): Promise<void> {
    const { claims } = this.verified();
    const { verifyOptions } = this.ctx;
    const assert = JSON.parse(matcher.content) as DomainAssert;
    const aegis = this.deployment();

    this.ctx.matched = aegis.matches(claims, assert, verifyOptions);

    await this.attempt(async () => aegis.assert(claims, assert, verifyOptions));
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

  /** The deployment the scenario stated; its clock tolerance is the window the check runs in. */
  private deployment(): IAegis {
    if (this.ctx.aegis !== undefined) return this.ctx.aegis;

    throw new Error("no deployment was stated in this scenario");
  }

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
