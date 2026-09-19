import { Binding, Given, ParameterType, Then, When } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { alternationOf } from "../__fixtures__/alternation-of.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { Wire, WireKey } from "../__fixtures__/raw-bucket.js";
import { signAsThirdParty } from "../__fixtures__/third-party-producer.js";
import { WIRE_ERROR, type WireError } from "../__fixtures__/wire-errors.js";

@Binding()
export class AegisVerifyOnlyProfileSteps extends AegisStepsBase {
  // what the verifier and the mint are asked beyond the sentence that acts

  @Given("the verifier expects the issuer {string}")
  theVerifierExpectsTheIssuer(issuer: string): void {
    this.ctx.verifyOptions.issuer = issuer;
  }

  @Given("the verifier leaves the issue instant unchecked")
  theVerifierLeavesTheIssueInstantUnchecked(): void {
    this.ctx.verifyOptions.verifyIssuedAt = false;
  }

  @Given("the mint stamps the issue instant {string}")
  theMintStampsTheIssueInstant(instant: string): void {
    this.ctx.mintOptions.sign = {
      ...this.ctx.mintOptions.sign,
      issuedAt: new Date(instant),
    };
  }

  @Given("the mint stamps the token id {string}")
  theMintStampsTheTokenId(tokenId: string): void {
    this.ctx.mintOptions.sign = { ...this.ctx.mintOptions.sign, tokenId };
  }

  // the acts

  @When("a third party signs the wire claims on the {wire} wire")
  async aThirdPartySignsTheWireClaims(wire: Wire): Promise<void> {
    this.ctx.token = await signAsThirdParty(
      wire,
      this.ctx.wireClaims,
      undefined,
      TEST_EC_KEY_SIG,
      this.ctx.foreignHeaders,
    );
  }

  @When("a third party signs the wire claims on the {wire} wire, typed {string}")
  async aThirdPartySignsTheWireClaimsTyped(wire: Wire, typ: string): Promise<void> {
    this.ctx.token = await signAsThirdParty(
      wire,
      this.ctx.wireClaims,
      typ,
      TEST_EC_KEY_SIG,
      this.ctx.foreignHeaders,
    );
  }

  // the raw wire, read off the bytes

  @Then("the raw payload carries {wireKey} as the instant {string}")
  theRawPayloadCarriesAsTheInstant(key: WireKey, instant: string): void {
    // A NumericDate (RFC 7519 §2): seconds since the epoch.
    expect(this.raw("payload").get(key)).toBe(new Date(instant).getTime() / 1000);
  }

  @Then("the raw payload carries a text string at {wireKey}")
  theRawPayloadCarriesATextStringAt(key: WireKey): void {
    expect(this.raw("payload").get(key)).toBeTypeOf("string");
  }

  @Then("the raw payload carries a byte string at {wireKey}")
  theRawPayloadCarriesAByteStringAt(key: WireKey): void {
    expect(this.raw("payload").get(key)).toBeInstanceOf(Uint8Array);
  }

  // the refusals

  @Then("verification is refused as a {wireError} error")
  verificationIsRefusedAsAWireError(error: WireError): void {
    expect(this.refusal()).toBeInstanceOf(WIRE_ERROR[error]);
  }

  @Then("the refusal reports the type header it read {string}")
  theRefusalReportsTheTypeHeaderItRead(typ: string): void {
    expect(this.refusal()).toMatchObject({ data: { typ } });
  }

  @Then("the refusal names the profile {string} and its declared use {string}")
  theRefusalNamesTheProfileAndItsDeclaredUse(profile: string, use: string): void {
    expect(this.refusal()).toMatchObject({ data: { profile, use } });
  }

  @Then(
    "the refusal reports the direction {string} and locates the fault at {string}: {}",
  )
  theRefusalReportsTheDirectionAndLocatesTheFault(
    direction: string,
    key: string,
    message: string,
  ): void {
    expect(this.refusal()).toMatchObject({
      data: { direction, invalid: [{ key, message }] },
    });
  }

  // parameter types

  @ParameterType("wireError", alternationOf(Object.keys(WIRE_ERROR)))
  static wireError(raw: string): WireError {
    return raw as WireError;
  }
}
