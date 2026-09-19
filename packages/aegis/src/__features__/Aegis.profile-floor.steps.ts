import type { DataTable, DocString } from "@lindorm/gherkin";
import { Binding, Given, Then, When } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { asObject } from "../__fixtures__/as-object.js";
import type { WireKey } from "../__fixtures__/raw-bucket.js";

@Binding()
export class AegisProfileFloorSteps extends AegisStepsBase {
  // the caller's statements

  @Given("the subject identifier")
  theSubjectIdentifier(table: DataTable): void {
    this.ctx.claims.subjectId = table.rowsHash();
  }

  @Given("the subject identifier is the object")
  theSubjectIdentifierIsTheObject(object: DocString): void {
    this.ctx.claims.subjectId = JSON.parse(object.content) as Dict;
  }

  @Given("an events map whose only event is {string}")
  anEventsMapWhoseOnlyEventIs(event: string): void {
    this.ctx.claims.events = { [event]: {} };
  }

  @Given("an authorization details list whose only element is the object")
  anAuthorizationDetailsListWhoseOnlyElementIsTheObject(object: DocString): void {
    this.ctx.claims.authorizationDetails = [JSON.parse(object.content) as Dict];
  }

  @Given("the wire claim {string} is the object")
  theWireClaimIsTheObject(name: string, object: DocString): void {
    this.ctx.wireClaims[name] = JSON.parse(object.content) as Dict;
  }

  // the acts

  @When("I read the token without a key")
  async iReadTheTokenWithoutAKey(): Promise<void> {
    const token = this.token();

    this.ctx.parsed = await this.attempt(async () => this.ctx.aegis.parse(token));
  }

  // the raw wire, read off the bytes

  @Then("the raw payload carries {wireKey} as the object")
  theRawPayloadCarriesAsTheObject(key: WireKey, object: DocString): void {
    expect(asObject(this.raw("payload").get(key))).toEqual(JSON.parse(object.content));
  }

  // the domain result

  @Then("the verified subject identifier is exactly")
  theVerifiedSubjectIdentifierIsExactly(table: DataTable): void {
    expect(this.verified().claims.subjectId).toEqual(table.rowsHash());
  }

  @Then("the verified subject identifier is exactly the object")
  theVerifiedSubjectIdentifierIsExactlyTheObject(object: DocString): void {
    expect(this.verified().claims.subjectId).toEqual(JSON.parse(object.content));
  }

  @Then("the verified claims carry the event {string} with an empty payload")
  theVerifiedClaimsCarryTheEventWithAnEmptyPayload(event: string): void {
    expect(this.verified().claims.events).toEqual({ [event]: {} });
  }

  // the refusals

  @Then("the keyless read is refused as a domain error {string}")
  theKeylessReadIsRefusedAsADomainError(code: string): void {
    this.refusedAsADomainError(code);
  }

  @Then("the refusal reports the direction {string} and lists the faults")
  theRefusalReportsTheDirectionAndListsTheFaults(
    direction: string,
    table: DataTable,
  ): void {
    expect(this.refusal()).toMatchObject({
      data: { direction, invalid: table.hashes() },
    });
  }

  @Then("the refusal names the claim {string} and lists the faults")
  theRefusalNamesTheClaimAndListsTheFaults(claim: string, table: DataTable): void {
    expect(this.refusal()).toMatchObject({ data: { claim, invalid: table.hashes() } });
  }
}
