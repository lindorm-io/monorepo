import { Binding, Then } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";

@Binding()
export class AegisIssuerPinSteps extends AegisStepsBase {
  // the refusals

  /**
   * The one refusal the exact-data table cannot serve: `kid` is the key id the mint
   * generated, which no scenario can state literally. `profile` has no value because
   * the key lookup is not given one (`internal/utils/resolve-key.ts`,
   * `ResolveKeyOptions.profile`); once it is, this step goes red for a reason the
   * sentence does not name.
   */
  @Then("the refusal names the issuer {string}, beside the key id it could not find")
  theRefusalNamesTheIssuer(issuer: string): void {
    expect(this.refusalData()).toStrictEqual({
      kid: expect.any(String),
      issuer,
      profile: undefined,
    });
  }
}
