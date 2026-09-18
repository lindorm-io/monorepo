import type { DataTable, DocString } from "@lindorm/gherkin";
import { Binding, Given, ParameterType, Then } from "@lindorm/gherkin";
import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import type { ActClaim, VerifyActorOptions } from "../types/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { alternationOf } from "../__fixtures__/alternation-of.js";
import type { WireKey } from "../__fixtures__/raw-bucket.js";

/** The two claims that carry an actor: the one acting, and the one permitted to (RFC 8693 §4.1, RFC 8693 §4.4). */
const ACTOR_CLAIMS = { "authorized actor": "mayAct", actor: "act" } as const;

type ActorClaimName = keyof typeof ACTOR_CLAIMS;
type ActorClaim = (typeof ACTOR_CLAIMS)[ActorClaimName];

/** A COSE map key as a table cell spells it: the integer label, or the text name (RFC 9052 §1.5). */
const coseKeyOf = (key: string, keyedBy: string): number | string => {
  switch (keyedBy) {
    case "label":
      return Number(key);

    case "name":
      return key;

    default:
      throw new Error(`a COSE map key is keyed by "label" or "name", not "${keyedBy}"`);
  }
};

/** `| key | keyed by | value |` — one map entry per row, every value cell JSON. */
const coseMapOf = (table: DataTable): Map<number | string, unknown> =>
  new Map(
    table
      .hashes()
      .map((row) => [coseKeyOf(row.key, row["keyed by"]), JSON.parse(row.value)]),
  );

@Binding()
export class AegisDelegationSteps extends AegisStepsBase {
  // the caller's statements

  @Given("the {actorClaim} claim is the object")
  theActorClaimIsTheObject(claim: ActorClaim, object: DocString): void {
    this.ctx.claims[claim] = JSON.parse(object.content) as Dict;
  }

  @Given("the wire claim {string} is the map")
  theWireClaimIsTheMap(name: string, table: DataTable): void {
    this.ctx.wireClaims[name] = coseMapOf(table);
  }

  @Given("the mint is asked for the compact COSE encoding")
  theMintIsAskedForTheCompactCoseEncoding(): void {
    this.ctx.mintOptions.proprietary = true;
  }

  // the actor policy the verifier states

  @Given("the verifier demands a delegated presentation")
  theVerifierDemandsADelegatedPresentation(): void {
    this.actorPolicy().required = true;
  }

  @Given("the verifier accepts only a direct presentation")
  theVerifierAcceptsOnlyADirectPresentation(): void {
    this.actorPolicy().forbidden = true;
  }

  @Given("the verifier admits only an actor matching")
  theVerifierAdmitsOnlyAnActorMatching(condition: DocString): void {
    this.actorPolicy().allowedActor = JSON.parse(
      condition.content,
    ) as Condition<ActClaim>;
  }

  @Given("the verifier bounds the delegation depth at {int}")
  theVerifierBoundsTheDelegationDepthAt(depth: number): void {
    this.actorPolicy().maxChainDepth = depth;
  }

  // the raw wire, read off the bytes

  @Then("the raw payload carries {wireKey} as the map")
  theRawPayloadCarriesAsTheMap(key: WireKey, table: DataTable): void {
    expect(this.raw("payload").get(key)).toEqual(coseMapOf(table));
  }

  // the domain result

  @Then("the verified delegation is exactly the object")
  theVerifiedDelegationIsExactlyTheObject(object: DocString): void {
    expect(this.verified().delegation).toEqual(JSON.parse(object.content));
  }

  @Then("the verified {actorClaim} claim is exactly the object")
  theVerifiedActorClaimIsExactlyTheObject(claim: ActorClaim, object: DocString): void {
    expect(this.verified().claims[claim]).toEqual(JSON.parse(object.content));
  }

  // the refusals

  @Then("the refusal names the claim {string}")
  theRefusalNamesTheClaim(claim: string): void {
    expect(this.refusal()).toMatchObject({ data: { claim } });
  }

  @Then(
    "the refusal names the member {string} of the claim {string}, keyed at both label {int} and name {string}",
  )
  theRefusalNamesTheMemberKeyedAtBothLabelAndName(
    member: string,
    claim: string,
    label: number,
    key: string,
  ): void {
    expect(this.refusal()).toMatchObject({ data: { claim, member, label, key } });
  }

  // parameter types

  @ParameterType("actorClaim", alternationOf(Object.keys(ACTOR_CLAIMS)))
  static actorClaim(raw: string): ActorClaim {
    return ACTOR_CLAIMS[raw as ActorClaimName];
  }

  // helpers

  /** The actor policy the sentences build up one knob at a time. */
  private actorPolicy(): VerifyActorOptions {
    return (this.ctx.verifyOptions.actor ??= {});
  }
}
