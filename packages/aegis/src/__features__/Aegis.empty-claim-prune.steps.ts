import type { DocString } from "@lindorm/gherkin";
import { Binding, Given, ParameterType, Then } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { alternationOf } from "../__fixtures__/alternation-of.js";
import type { WireKey } from "../__fixtures__/raw-bucket.js";

/** The claims the domain states as a list, in the same spelling as the JSON literal type. */
type ListClaim = "audience" | "scope" | "roles";

/** The claims a scenario states as `null` — a nullable column handed straight in. */
const NULLABLE_CLAIMS = ["confirmation", "events", "audience"] as const;

type NullableClaim = (typeof NULLABLE_CLAIMS)[number];

/** The three ID Token binding digests a mint stamps, by the artifact each hashes. */
const HASH_KINDS = {
  "access token": "accessTokenHash",
  code: "codeHash",
  state: "stateHash",
} as const;

type HashKind = keyof typeof HASH_KINDS;

@Binding()
export class AegisEmptyClaimPruneSteps extends AegisStepsBase {
  // the caller's statements

  @Given("an empty {listClaim} list")
  anEmptyList(claim: ListClaim): void {
    this.ctx.claims[claim] = [];
  }

  @Given("an empty authorization details list")
  anEmptyAuthorizationDetailsList(): void {
    this.ctx.claims.authorizationDetails = [];
  }

  @Given("the events claim is the object")
  theEventsClaimIsTheObject(object: DocString): void {
    this.ctx.claims.events = JSON.parse(object.content) as Dict;
  }

  @Given("the {nullableClaim} claim is stated as null")
  theClaimIsStatedAsNull(claim: NullableClaim): void {
    this.ctx.claims[claim] = null;
  }

  @Given("the content's claims container is the object")
  theContentsClaimsContainerIsTheObject(object: DocString): void {
    this.ctx.claims.claims = JSON.parse(object.content) as Dict;
  }

  @Given("the opaque payload is the object")
  theOpaquePayloadIsTheObject(object: DocString): void {
    this.ctx.claims = JSON.parse(object.content) as Dict;
  }

  @Given("the mint stamps the {hashKind} hash {string}")
  theMintStampsTheHash(kind: HashKind, digest: string): void {
    this.ctx.mintOptions.sign = {
      ...this.ctx.mintOptions.sign,
      [HASH_KINDS[kind]]: digest,
    };
  }

  // the raw wire, read off the bytes

  @Then("the raw payload carries {wireKey} as the empty list")
  theRawPayloadCarriesAsTheEmptyList(key: WireKey): void {
    expect(this.raw("payload").get(key)).toEqual([]);
  }

  // the domain result

  @Then("the verified claims list an empty {listClaim}")
  theVerifiedClaimsListAnEmpty(claim: ListClaim): void {
    expect(this.verified().claims[claim]).toEqual([]);
  }

  // the refusals

  @Then("the refusal names the claim {string} under the empty-value ruling {string}")
  theRefusalNamesTheClaimUnderTheEmptyValueRuling(
    claim: string,
    whenEmpty: string,
  ): void {
    expect(this.refusal()).toMatchObject({ data: { claim, whenEmpty } });
  }

  // parameter types

  @ParameterType("nullableClaim", alternationOf(NULLABLE_CLAIMS))
  static nullableClaim(raw: string): NullableClaim {
    return raw as NullableClaim;
  }

  @ParameterType("hashKind", alternationOf(Object.keys(HASH_KINDS)))
  static hashKind(raw: string): HashKind {
    return raw as HashKind;
  }
}
