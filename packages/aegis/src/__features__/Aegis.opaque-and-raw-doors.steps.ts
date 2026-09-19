import type { DataTable } from "@lindorm/gherkin";
import { Binding, Given, Then, When } from "@lindorm/gherkin";
import type { KryptosAlgClass } from "@lindorm/kryptos";
import { expect } from "vitest";
import { AegisKeyError } from "../errors/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import type { Wire } from "../__fixtures__/raw-bucket.js";
import { OPAQUE_FORMAT } from "../__fixtures__/wire-formats.js";

@Binding()
export class AegisOpaqueAndRawDoorsSteps extends AegisStepsBase {
  // the caller's statements

  @Given("the text to sign {string}")
  theTextToSign(text: string): void {
    this.ctx.text = text;
  }

  @Given("the opaque signature carries the type prefix {string}")
  theOpaqueSignatureCarriesTheTypePrefix(prefix: string): void {
    this.ctx.typPrefix = prefix;
  }

  // the verifier's key policy

  @Given("the verifier accepts only a signing key of the {algClass} class")
  theVerifierAcceptsOnlyASigningKeyOfTheClass(algClass: KryptosAlgClass): void {
    this.ctx.verifyOptions.key = { condition: { algClass } };
  }

  // the acts

  @When("I sign the text as opaque content on the {wire} wire")
  async iSignTheTextAsOpaqueContent(wire: Wire): Promise<void> {
    const format = OPAQUE_FORMAT[wire];
    const { text } = this.ctx;

    if (text === undefined) {
      throw new Error("no text to sign was stated in this scenario");
    }

    const signed = await this.attempt(() =>
      format === "cws"
        ? this.ctx.aegis.cws.sign(text, this.coseEnvelope())
        : this.ctx.aegis.jws.sign(text, this.joseEnvelope()),
    );

    if (signed === undefined) return;

    expect(signed.format).toBe(format);

    this.ctx.signed = signed;
    this.ctx.token = signed.token;
  }

  // the domain result

  @Then("the verified opaque payload includes")
  theVerifiedOpaquePayloadIncludes(table: DataTable): void {
    expect(this.verifiedOpaquePayload()).toMatchObject(table.rowsHash());
  }

  @Then("the verified opaque payload is the text {string}")
  theVerifiedOpaquePayloadIsTheText(text: string): void {
    expect(this.verifiedOpaquePayload()).toBe(text);
  }

  @Then("the verified claim buckets are empty")
  theVerifiedClaimBucketsAreEmpty(): void {
    const { claims, custom } = this.verified();

    expect(claims).toEqual({});
    expect(custom).toEqual({});
  }

  // the raw door's result

  @Then("the raw door reports the payload")
  theRawDoorReportsThePayload(table: DataTable): void {
    const { payload } = this.rawVerified();

    expect(payload, "the raw door reported no payload").toBeDefined();
    expect(payload).toEqual(table.rowsHash());
  }

  // the refusals

  @Then("verification is refused as a key error {string}")
  verificationIsRefusedAsAKeyErrorUnder(code: string): void {
    const refusal = this.refusal();

    expect(refusal).toBeInstanceOf(AegisKeyError);
    expect(refusal).toMatchObject({ code });
  }

  // helpers

  /** The opaque payload the domain verify delivered; a verify that delivered none is a failed premise. */
  private verifiedOpaquePayload(): unknown {
    const { raw } = this.verified();

    if (raw !== undefined) return raw;

    throw new Error("the verified result carries no opaque payload");
  }
}
