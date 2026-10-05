import type { DataTable } from "@lindorm/gherkin";
import { Binding, Given, Then, When } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { jsonCells } from "../__fixtures__/json-cells.js";
import type { Wire } from "../__fixtures__/raw-bucket.js";
import { SIGNED_FORMAT } from "../__fixtures__/wire-formats.js";

/** RFC 8392 §3.1.7: the CWT ID claim is `cti` where the JWT claim is `jti`; every other registered name is shared. */
const CWT_NAME: Readonly<Record<string, string>> = { jti: "cti" };

const respellForCwt = (claims: Dict): Dict =>
  Object.fromEntries(
    Object.entries(claims).map(([name, value]) => [CWT_NAME[name] ?? name, value]),
  );

/** A NumericDate (RFC 7519 §2): seconds since the epoch. */
const numericDate = (instant: string): number =>
  Math.floor(new Date(instant).getTime() / 1000);

@Binding()
export class AegisAudienceFloorSteps extends AegisStepsBase {
  // the wire claims, stated in the wire's own vocabulary

  @Given("the wire claims")
  theWireClaims(table: DataTable): void {
    this.ctx.wireClaims = jsonCells(table);
  }

  @Given("the wire claim {string} is the empty string")
  theWireClaimIsTheEmptyString(name: string): void {
    this.ctx.wireClaims[name] = "";
  }

  @Given("the wire claims leave out {string}")
  theWireClaimsLeaveOut(name: string): void {
    const { [name]: _left, ...rest } = this.ctx.wireClaims;

    this.ctx.wireClaims = rest;
  }

  @Given("the wire claims were issued at {string}")
  theWireClaimsWereIssuedAt(instant: string): void {
    this.ctx.wireClaims.iat = numericDate(instant);
  }

  @Given("the wire claims expire at {string}")
  theWireClaimsExpireAt(instant: string): void {
    this.ctx.wireClaims.exp = numericDate(instant);
  }

  @Given("the claims token carries the type prefix {string}")
  theClaimsTokenCarriesTheTypePrefix(prefix: string): void {
    this.ctx.typPrefix = prefix;
  }

  // the acts

  @When("I sign the wire claims as a claims token on the {wire} wire")
  async iSignTheWireClaimsAsAClaimsToken(wire: Wire): Promise<void> {
    this.assertScenarioWire(wire);
    const format = SIGNED_FORMAT[wire];

    const signed = await this.attempt(() =>
      format === "cwt"
        ? this.ctx.aegis.cwt.sign(respellForCwt(this.ctx.wireClaims), this.coseEnvelope())
        : this.ctx.aegis.jwt.sign(this.ctx.wireClaims, this.joseEnvelope()),
    );

    if (signed === undefined) return;

    // The sentence names the wire; the artifact must be that wire's claims format.
    expect(signed.format).toBe(format);

    this.ctx.signed = signed;
    this.ctx.token = signed.token;
  }

  // the refusals

  @Then("verification is refused as a domain error {string}")
  verificationIsRefusedAsADomainError(code: string): void {
    this.refusedAsADomainError(code);
  }

  @Then("the refusal reports the audience it read as the list {stringList}")
  theRefusalReportsTheAudienceItRead(audience: Array<string>): void {
    expect(this.refusalData()).toStrictEqual({ audience });
  }
}
