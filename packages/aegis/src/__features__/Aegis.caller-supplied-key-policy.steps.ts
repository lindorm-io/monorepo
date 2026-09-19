import { Binding, Given } from "@lindorm/gherkin";
import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";

@Binding()
export class AegisCallerSuppliedKeyPolicySteps extends AegisStepsBase {
  // the verifier's key policy

  @Given("the verifier accepts only a signing key of the algorithm {string}")
  theVerifierAcceptsOnlyASigningKeyOfTheAlgorithm(algorithm: string): void {
    this.ctx.verifyOptions.key = {
      condition: { algorithm: algorithm as KryptosSigAlgorithm },
    };
  }
}
