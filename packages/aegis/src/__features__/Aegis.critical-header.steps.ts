import type { DataTable } from "@lindorm/gherkin";
import { Binding, Given, ParameterType, Then, When } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { CoseError, CwtError, JoseError, JwtError } from "../errors/index.js";
import type { CoseHeaderBuckets, JoseHeaderBuckets } from "../types/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { jsonCells } from "../__fixtures__/json-cells.js";
import type { Wire, WireKey } from "../__fixtures__/raw-bucket.js";
import { SEALED_FORMAT } from "../__fixtures__/wire-formats.js";

/** The wire error a door refuses under, by the same names `{wireError}` binds. */
const WIRE_ERROR = {
  JOSE: JoseError,
  COSE: CoseError,
  JWT: JwtError,
  CWT: CwtError,
} as const;

type WireError = keyof typeof WIRE_ERROR;

/** A JSON string, integer or flat array — the shapes a refusal's `data` spells a crit member or list in. */
const JSON_VALUE = /"(?:[^"\\]|\\.)*"|-?\d+|\[[^\]]*\]/;

/**
 * A JOSE kit reports its one header as `header`; a COSE kit reports the protected
 * one beside the unprotected. `in` on a literal from the result type, never a
 * token's key.
 */
const isJoseBuckets = (
  buckets: JoseHeaderBuckets | CoseHeaderBuckets,
): buckets is JoseHeaderBuckets => "header" in buckets;

@Binding()
export class AegisCriticalHeaderSteps extends AegisStepsBase {
  // the caller's header statements, for a raw kit door

  @Given("the wire header")
  theWireHeader(table: DataTable): void {
    this.ctx.wireHeader = jsonCells(table);
  }

  @Given("the custom header")
  theCustomHeader(table: DataTable): void {
    this.ctx.customHeader.header = jsonCells(table);
  }

  @Given("the custom unprotected header")
  theCustomUnprotectedHeader(table: DataTable): void {
    this.ctx.customHeader.unprotected = jsonCells(table);
  }

  // the caller's header statements, for a domain door

  @Given("the domain header")
  theDomainHeader(table: DataTable): void {
    this.ctx.domainHeader = jsonCells(table);
  }

  // what a third party writes

  @Given("the foreign protected header carries")
  theForeignProtectedHeaderCarries(table: DataTable): void {
    this.ctx.foreignHeaders.protectedHeader = jsonCells(table);
  }

  @Given("the foreign unprotected header carries")
  theForeignUnprotectedHeaderCarries(table: DataTable): void {
    this.ctx.foreignHeaders.unprotectedHeader = jsonCells(table);
  }

  @Given("the foreign protected header carries, under text labels")
  theForeignProtectedHeaderCarriesUnderTextLabels(table: DataTable): void {
    this.ctx.foreignHeaders.textLabelledProtected = jsonCells(table);
  }

  // the recipient's declaration, forwarded by every reading door

  @Given("the recipient declares the critical parameter {string}")
  theRecipientDeclaresTheCriticalParameter(name: string): void {
    (this.ctx.verifyOptions.critical ??= []).push(name);
  }

  // the acts at the raw doors

  @When("I verify the token as a claims token on the {wire} wire")
  async iVerifyTheTokenAsAClaimsToken(wire: Wire): Promise<void> {
    const token = this.token();
    const options = { crit: this.ctx.verifyOptions.critical };

    // The sentence names the wire; the token must be that wire's.
    expect(this.inspected().wire).toBe(wire);

    this.ctx.rawVerified = await this.attempt<JoseHeaderBuckets | CoseHeaderBuckets>(
      () =>
        wire === "cose"
          ? this.ctx.aegis.cwt.verify(token, undefined, options)
          : this.ctx.aegis.jwt.verify(token, undefined, options),
    );
  }

  @When("I verify the token as opaque content on the {wire} wire")
  async iVerifyTheTokenAsOpaqueContent(wire: Wire): Promise<void> {
    const token = this.token();
    const options = { crit: this.ctx.verifyOptions.critical };

    expect(this.inspected().wire).toBe(wire);

    this.ctx.rawVerified = await this.attempt<JoseHeaderBuckets | CoseHeaderBuckets>(
      () =>
        wire === "cose"
          ? this.ctx.aegis.cws.verify(token, options)
          : this.ctx.aegis.jws.verify(token, options),
    );
  }

  @When("I encrypt the text as sealed content on the {wire} wire")
  async iEncryptTheTextAsSealedContent(wire: Wire): Promise<void> {
    const { text } = this.ctx;

    if (text === undefined) {
      throw new Error("no text to encrypt was stated in this scenario");
    }

    await this.seal(wire, text);
  }

  @When("I encrypt the data as sealed content on the {wire} wire")
  async iEncryptTheDataAsSealedContent(wire: Wire): Promise<void> {
    await this.seal(wire, this.ctx.claims);
  }

  // the raw door's result

  @Then("the raw door accepts the token")
  theRawDoorAcceptsTheToken(): void {
    this.rawVerified();
  }

  @Then("the wire-tier header carries no {string}")
  theWireTierHeaderCarriesNo(name: string): void {
    expect(this.wireTierHeader()).not.toHaveProperty(name);
  }

  @Then("the wire-tier protected custom bag carries {string} {string}")
  theWireTierProtectedCustomBagCarries(name: string, value: string): void {
    const bag = this.wireTierProtectedCustomBag();

    expect(Object.hasOwn(bag, name), `the protected custom bag carries no ${name}`).toBe(
      true,
    );
    expect(bag[name]).toBe(value);
  }

  // the domain result

  @Then("the verified header includes")
  theVerifiedHeaderIncludes(table: DataTable): void {
    expect(this.verified().header).toMatchObject(jsonCells(table));
  }

  @Then("the verified header carries no {string}")
  theVerifiedHeaderCarriesNo(name: string): void {
    expect(this.verified().header).not.toHaveProperty(name);
  }

  // the raw wire, read off the bytes

  @Then("the raw protected header carries {wireKey} as the list {stringList}")
  theRawProtectedHeaderCarriesAsTheList(key: WireKey, members: Array<string>): void {
    expect(this.raw("protectedHeader").get(key)).toEqual(members);
  }

  // the refusals

  @Then("signing is refused as a {wireError} error")
  signingIsRefusedAsAWireError(error: WireError): void {
    expect(this.refusal()).toBeInstanceOf(WIRE_ERROR[error]);
  }

  @Then("signing is refused as a {wireError} error {string}")
  signingIsRefusedAsAWireErrorUnder(error: WireError, code: string): void {
    this.refusedAsAWireError(error, code);
  }

  @Then("verification is refused as a {wireError} error {string}")
  verificationIsRefusedAsAWireErrorUnder(error: WireError, code: string): void {
    this.refusedAsAWireError(error, code);
  }

  @Then("the keyless read is refused as a {wireError} error {string}")
  theKeylessReadIsRefusedAsAWireError(error: WireError, code: string): void {
    this.refusedAsAWireError(error, code);
  }

  @Then("the refusal reports the critical list {json}")
  theRefusalReportsTheCriticalList(crit: unknown): void {
    expect(this.refusal()).toMatchObject({ data: { crit } });
  }

  @Then("the refusal names the parameter {json}")
  theRefusalNamesTheParameter(parameter: unknown): void {
    expect(this.refusal()).toMatchObject({ data: { parameter } });
  }

  @Then("the refusal names the undeclared parameter {string}")
  theRefusalNamesTheUndeclaredParameter(param: string): void {
    expect(this.refusal()).toMatchObject({ data: { param } });
  }

  @Then(
    "the refusal names the parameter {string} and expects the domain spelling {string}",
  )
  theRefusalNamesTheParameterAndExpectsTheDomainSpelling(
    parameter: string,
    expected: string,
  ): void {
    expect(this.refusal()).toMatchObject({ data: { parameter, expected } });
  }

  // parameter types

  @ParameterType("json", JSON_VALUE)
  static json(raw: string): unknown {
    return JSON.parse(raw);
  }

  // helpers

  private async seal(wire: Wire, content: string | Dict): Promise<void> {
    const format = SEALED_FORMAT[wire];

    const encrypted = await this.attempt(() =>
      format === "cwe"
        ? this.ctx.aegis.cwe.encrypt(content, this.coseEnvelope())
        : this.ctx.aegis.jwe.encrypt(content, this.joseEnvelope()),
    );

    if (encrypted === undefined) return;

    expect(encrypted.format).toBe(format);

    this.ctx.encrypted = encrypted;
    this.ctx.token = encrypted.token;
  }

  private refusedAsAWireError(error: WireError, code: string): void {
    const refusal = this.refusal();

    expect(refusal).toBeInstanceOf(WIRE_ERROR[error]);
    expect(refusal).toMatchObject({ code });
  }

  /** The typed header a raw door reports: JOSE's one header, COSE's protected bucket. */
  private wireTierHeader(): Dict {
    const buckets = this.rawVerified();

    return isJoseBuckets(buckets) ? buckets.header : buckets.protectedHeader;
  }

  /** The custom bag a raw door reports for the protected bucket, which on JOSE is the one header. */
  private wireTierProtectedCustomBag(): Record<string, unknown> {
    const buckets = this.rawVerified();

    return isJoseBuckets(buckets) ? buckets.custom.header : buckets.custom.protected;
  }
}
