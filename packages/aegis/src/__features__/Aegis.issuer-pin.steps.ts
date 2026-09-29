import { Binding, Then } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";

@Binding()
export class AegisIssuerPinSteps extends AegisStepsBase {
  // the refusals

  /**
   * The one refusal the exact-data table cannot serve: `kid` is the key id the mint
   * generated, which no scenario can state literally. `data` carries a third member
   * `profile`, undefined on this path because the key lookup is not given one
   * (`internal/utils/resolve-key.ts`, `ResolveKeyOptions.profile`); state it here
   * once it is, or this step goes red for a reason the sentence does not name.
   */
  @Then("the refusal names the issuer {string}, beside the key id it could not find")
  theRefusalNamesTheIssuer(issuer: string): void {
    expect(this.refusalData()).toEqual({ kid: expect.any(String), issuer });
  }
}
