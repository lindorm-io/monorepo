import type { DocString } from "@lindorm/gherkin";
import { Binding, Given, Then } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { asObject } from "../__fixtures__/as-object.js";
import type { WireKey } from "../__fixtures__/raw-bucket.js";

@Binding()
export class AegisConfidentialityGateSteps extends AegisStepsBase {
  // the caller's statements

  @Given("the profile claims are the object")
  theProfileClaimsAreTheObject(object: DocString): void {
    this.ctx.claims.profile = JSON.parse(object.content) as Dict;
  }

  @Given("the sensitive claims are the object")
  theSensitiveClaimsAreTheObject(object: DocString): void {
    this.ctx.claims.sensitive = JSON.parse(object.content) as Dict;
  }

  // the raw wire, read off the bytes

  @Then("the raw payload carries {wireKey} as an object including")
  theRawPayloadCarriesAsAnObjectIncluding(key: WireKey, object: DocString): void {
    expect(asObject(this.raw("payload").get(key))).toMatchObject(
      JSON.parse(object.content) as Dict,
    );
  }

  @Then("the raw payload carries {wireKey} as null")
  theRawPayloadCarriesAsNull(key: WireKey): void {
    const payload = this.raw("payload");

    expect(payload.has(key), `the raw payload carries no ${String(key)}`).toBe(true);
    expect(payload.get(key)).toBeNull();
  }

  // the domain result

  @Then("the verified sensitive bucket is exactly the object")
  theVerifiedSensitiveBucketIsExactlyTheObject(object: DocString): void {
    expect(this.verified().sensitive).toEqual(JSON.parse(object.content));
  }

  @Then("the verified profile bucket is exactly the object")
  theVerifiedProfileBucketIsExactlyTheObject(object: DocString): void {
    expect(this.verified().profile).toEqual(JSON.parse(object.content));
  }

  @Then("the verified token carries no sensitive bucket")
  theVerifiedTokenCarriesNoSensitiveBucket(): void {
    expect(this.verified().sensitive).toBeUndefined();
  }

  @Then("the verified token carries no profile bucket")
  theVerifiedTokenCarriesNoProfileBucket(): void {
    expect(this.verified().profile).toBeUndefined();
  }

  @Then("the verified claims carry no {string}")
  theVerifiedClaimsCarryNo(name: string): void {
    expect(this.verified().claims).not.toHaveProperty(name);
  }

  @Then("the verified custom bucket carries no {string}")
  theVerifiedCustomBucketCarriesNo(name: string): void {
    expect(this.verified().custom).not.toHaveProperty(name);
  }

  @Then("the verified delegation reports a delegated presentation")
  theVerifiedDelegationReportsADelegatedPresentation(): void {
    expect(this.verified().delegation?.isDelegated).toBe(true);
  }
}
