import type { DataTable } from "@lindorm/gherkin";
import { Binding, Given, ParameterType, Then, When } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisKeyError } from "../errors/index.js";
import type { ProfileClaimName, SignContent } from "../types/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import type { Wire, WireKey } from "../__fixtures__/raw-bucket.js";
import { SIGNED_FORMAT } from "../__fixtures__/wire-formats.js";

/** The claims the domain states as a list, in the same spelling as the JSON literal type. */
type ListClaim = "audience" | "scope" | "roles";

/** `"a", "b"` — quoted members, comma-separated; `\"` spells a quote inside one. */
const QUOTED = /"(?:[^"\\]|\\.)*"/;
const STRING_LIST = new RegExp(`${QUOTED.source}(?:, ${QUOTED.source})*`);
const INT_LIST = /-?\d+(?:, -?\d+)*/;

const toStrings = (raw: string): Array<string> =>
  (raw.match(new RegExp(QUOTED.source, "g")) ?? []).map((member) =>
    member.slice(1, -1).replace(/\\"/g, '"'),
  );

@Binding()
export class AegisRoundTripSteps extends AegisStepsBase {
  // the caller's statements

  @Given("the content to mint")
  theContentToMint(table: DataTable): void {
    this.ctx.claims = table.rowsHash();
  }

  @Given("a(n) {listClaim} list whose members are {stringList}")
  aListWhoseMembersAre(claim: ListClaim, members: Array<string>): void {
    this.ctx.claims[claim] = members;
  }

  @Given("the content expires in {string}")
  theContentExpiresIn(expiry: string): void {
    this.ctx.claims.expires = expiry;
  }

  @Given("a registered profile {string} that demands the claims {stringList}")
  aRegisteredProfileThatDemandsTheClaims(name: string, claims: Array<string>): void {
    this.ctx.aegis.registerProfile({
      name,
      typ: { presence: "none" },
      policy: [
        {
          rule: "required",
          on: ["mint", "verify"],
          claims: claims as Array<ProfileClaimName>,
        },
      ],
      autoInject: ["issuedAt", "tokenId", "issuer"],
      issuer: "platform",
      lifetime: "5m",
      encryptable: false,
    });
  }

  @Given("the mint is asked to seal the token")
  theMintIsAskedToSealTheToken(): void {
    this.ctx.mintOptions.encrypt = {};
  }

  @Given("no access token is co-issued")
  noAccessTokenIsCoIssued(): void {
    this.ctx.mintOptions.context = {
      ...this.ctx.mintOptions.context,
      accessTokenIssued: false,
    };
  }

  // the acts

  @When("I mint the content under the {string} profile on the {wire} wire")
  async iMintTheContent(profile: string, wire: Wire): Promise<void> {
    const format = SIGNED_FORMAT[wire];

    const minted = await this.attempt(() =>
      this.ctx.aegis.mint(profile, this.content(), { ...this.ctx.mintOptions, format }),
    );

    if (minted === undefined) return;

    // The sentence names the wire; the artifact must be that wire's claims format.
    expect(minted.format).toBe(format);

    this.ctx.signed = minted;
    this.ctx.token = minted.token;
  }

  @When("I verify the token under the {string} profile as the audience {string}")
  async iVerifyTheTokenUnderTheProfile(profile: string, audience: string): Promise<void> {
    const token = this.token();

    this.ctx.verified = await this.attempt(() =>
      this.ctx.aegis.verify(profile, token, this.ctx.assert, {
        ...this.ctx.verifyOptions,
        audience,
      }),
    );
  }

  @When("I verify the token asserting the scope {string}")
  async iVerifyTheTokenAssertingTheScope(scope: string): Promise<void> {
    const token = this.token();

    this.ctx.verified = await this.attempt(() => this.ctx.aegis.verify(token, { scope }));
  }

  // the raw wire, read off the bytes

  @Then("the raw payload carries {wireKey} as the list {stringList}")
  theRawPayloadCarriesAsTheList(key: WireKey, members: Array<string>): void {
    expect(this.raw("payload").get(key)).toEqual(members);
  }

  @Then("the raw token is a compact serialisation of {int} parts")
  theRawTokenIsACompactSerialisationOfParts(parts: number): void {
    const inspection = this.inspected();

    if (inspection.wire !== "jose") {
      throw new Error(
        "the token is a COSE structure, which has no compact-serialisation parts",
      );
    }

    expect(inspection.partCount).toBe(parts);
  }

  @Then("the raw token carries the CBOR tag chain {intList}")
  theRawTokenCarriesTheCborTagChain(tags: Array<number>): void {
    const inspection = this.inspected();

    if (inspection.wire !== "cose") {
      throw new Error(
        "the token is a JOSE compact serialisation, which carries no CBOR tag",
      );
    }

    expect(inspection.tags).toEqual(tags);
  }

  // the domain result

  @Then("the verified claims list the {listClaim} {stringList}")
  theVerifiedClaimsListThe(claim: ListClaim, members: Array<string>): void {
    expect(this.verified().claims[claim]).toEqual(members);
  }

  @Then("the untranslated payload carries {string} {string}")
  theUntranslatedPayloadCarries(key: string, value: string): void {
    const wire = this.verified().wire;

    expect(
      wire,
      "the verified result passes no untranslated payload through",
    ).toBeDefined();
    expect(wire?.payload[key]).toBe(value);
  }

  // the refusals

  @Then("minting is refused as a domain error {string}")
  mintingIsRefusedAsADomainErrorUnder(code: string): void {
    this.refusedAsADomainError(code);
  }

  @Then("minting is refused as a domain error")
  mintingIsRefusedAsADomainError(): void {
    this.refusedAsADomainError(undefined);
  }

  @Then("minting is refused as a key error")
  mintingIsRefusedAsAKeyError(): void {
    expect(this.refusal()).toBeInstanceOf(AegisKeyError);
  }

  @Then("the refusal names the profile {string}")
  theRefusalNamesTheProfile(profile: string): void {
    expect(this.refusal()).toMatchObject({ data: { profile } });
  }

  // parameter types

  @ParameterType("stringList", STRING_LIST)
  static stringList(raw: string): Array<string> {
    return toStrings(raw);
  }

  @ParameterType("intList", INT_LIST)
  static intList(raw: string): Array<number> {
    return raw.split(", ").map(Number);
  }

  // helpers

  /** The caller's statements, with the token type they named among them. */
  private content(): SignContent {
    const { claims, tokenType } = this.ctx;

    return tokenType === undefined ? claims : { ...claims, tokenType };
  }
}
