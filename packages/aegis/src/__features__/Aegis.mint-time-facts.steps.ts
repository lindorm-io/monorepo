import type { DocString } from "@lindorm/gherkin";
import { Binding, Given, Then } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import type { ProfileClaimName, ShapeRuleName, SignContext } from "../types/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";

/** The structural validators a registered profile may name, as the policy spells them. */
const SHAPE_RULES: ReadonlyArray<ShapeRuleName> = [
  "actChain",
  "confirmation",
  "crossField",
  "events",
  "subjectId",
];

const isShapeRule = (raw: string): raw is ShapeRuleName =>
  SHAPE_RULES.includes(raw as ShapeRuleName);

@Binding()
export class AegisMintTimeFactsSteps extends AegisStepsBase {
  // the caller's statements

  @Given("the content to mint is the object")
  theContentToMintIsTheObject(object: DocString): void {
    this.ctx.claims = JSON.parse(object.content) as Dict;
  }

  @Given("the mint context is the object")
  theMintContextIsTheObject(object: DocString): void {
    // The context is a closed record, so the misspelling a sentence states is
    // unwritable by a typed caller; the object is what an untyped one hands in.
    this.ctx.mintOptions.context = JSON.parse(object.content) as SignContext;
  }

  @Given(
    "a registered profile {string} that demands the claims {stringList} and checks the shape of {string}",
  )
  aRegisteredProfileThatDemandsTheClaimsAndChecksTheShapeOf(
    name: string,
    claims: Array<string>,
    shape: string,
  ): void {
    if (!isShapeRule(shape)) {
      throw new Error(`"${shape}" is not a shape a registered profile can check`);
    }

    this.ctx.aegis.registerProfile({
      name,
      typ: { presence: "none" },
      policy: [
        {
          rule: "required",
          on: ["mint", "verify"],
          claims: claims as Array<ProfileClaimName>,
        },
        { rule: "shape", on: ["mint", "verify"], shape },
      ],
      autoInject: ["issuedAt", "tokenId", "issuer"],
      issuer: "platform",
      lifetime: "5m",
      encryptable: false,
    });
  }

  // the refusals

  @Then("the refusal names the missing mint context {stringList}")
  theRefusalNamesTheMissingMintContext(missing: Array<string>): void {
    expect(this.refusal()).toMatchObject({ data: { missing } });
  }
}
