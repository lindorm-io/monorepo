import type { DataTable } from "@lindorm/gherkin";
import { Binding, Given, Then, When } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { Aegis } from "../classes/Aegis.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { jsonCells } from "../__fixtures__/json-cells.js";

@Binding()
export class AegisVocabularyDoorSteps extends AegisStepsBase {
  // the dict, stated in whichever vocabulary the scenario is about

  @Given("the claim dict")
  theClaimDict(table: DataTable): void {
    this.ctx.dict = jsonCells(table);
  }

  // the act

  @When("I read the claim dict into the domain vocabulary")
  async iReadTheClaimDictIntoTheDomainVocabulary(): Promise<void> {
    await this.attempt(async () => {
      this.ctx.buckets = Aegis.toDomain(this.ctx.dict);
    });
  }

  // the verdicts

  @Then("the domain claims are")
  theDomainClaimsAre(table: DataTable): void {
    expect(this.read().claims).toEqual(jsonCells(table));
  }

  @Then("the custom claims are")
  theCustomClaimsAre(table: DataTable): void {
    expect(this.read().custom).toEqual(jsonCells(table));
  }

  @Then("the custom bucket is empty")
  theCustomBucketIsEmpty(): void {
    expect(this.read().custom).toEqual({});
  }

  @Then("the read is refused as a domain error {string}")
  theReadIsRefusedAsADomainError(code: string): void {
    this.refusedAsADomainError(code);
  }

  // helpers

  private read(): { claims: Dict; custom: Dict } {
    if (this.ctx.refusal !== undefined) {
      throw new Error("the claim dict was refused, so it resolved no buckets", {
        cause: this.ctx.refusal,
      });
    }

    if (this.ctx.buckets !== undefined) return this.ctx.buckets;

    throw new Error("no claim dict was read in this scenario");
  }
}
