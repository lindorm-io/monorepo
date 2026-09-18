import type { DataTable } from "@lindorm/gherkin";
import { Binding, Given, Then, When } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import type { Wire } from "../__fixtures__/raw-bucket.js";
import { SIGNED_FORMAT } from "../__fixtures__/wire-formats.js";

/** RFC 8392 §3.1.7: the CWT ID claim is `cti` where the JWT claim is `jti`; every other registered name is shared. */
const CWT_NAME: Readonly<Record<string, string>> = { jti: "cti" };

const respellForCwt = (claims: Dict): Dict =>
  Object.fromEntries(
    Object.entries(claims).map(([name, value]) => [CWT_NAME[name] ?? name, value]),
  );

/** Every value cell is JSON, so a table states a list, a number, an object or the empty string unambiguously. */
const jsonCells = (table: DataTable): Dict =>
  Object.fromEntries(
    Object.entries(table.rowsHash()).map(([key, cell]) => {
      try {
        return [key, JSON.parse(cell)];
      } catch {
        throw new Error(`the cell for "${key}" is not JSON: ${cell}`);
      }
    }),
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
    const format = SIGNED_FORMAT[wire];
    const options = { tokenType: this.ctx.typPrefix };

    const signed = await this.attempt(() =>
      format === "cwt"
        ? this.ctx.aegis.cwt.sign(respellForCwt(this.ctx.wireClaims), options)
        : this.ctx.aegis.jwt.sign(this.ctx.wireClaims, options),
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
    expect(this.refusal()).toMatchObject({ data: { audience } });
  }
}
