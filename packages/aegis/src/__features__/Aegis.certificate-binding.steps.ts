import { Binding, Given, Then } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisKeyError } from "../errors/index.js";
import type { BindCertificateMode } from "../types/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { TEST_EC_KEY_SIG_CERT } from "../__fixtures__/keys.js";

/** The bindings a mint can be asked for, as the option spells them. */
const BIND_CERTIFICATE_MODES: ReadonlyArray<BindCertificateMode> = [
  "none",
  "thumbprint",
  "chain",
];

const isBindCertificateMode = (raw: string): raw is BindCertificateMode =>
  BIND_CERTIFICATE_MODES.includes(raw as BindCertificateMode);

@Binding()
export class AegisCertificateBindingSteps extends AegisStepsBase {
  // the mint's key policy and binding

  @Given("the mint selects the signing key that carries a certificate chain")
  theMintSelectsTheSigningKeyThatCarriesACertificateChain(): void {
    this.ctx.mintOptions.sign = {
      ...this.ctx.mintOptions.sign,
      key: { condition: { id: TEST_EC_KEY_SIG_CERT.id } },
    };
  }

  @Given("the mint is asked for the certificate binding {string}")
  theMintIsAskedForTheCertificateBinding(mode: string): void {
    if (!isBindCertificateMode(mode)) {
      throw new Error(`"${mode}" is not a certificate binding a mint can be asked for`);
    }

    this.ctx.mintOptions.sign = { ...this.ctx.mintOptions.sign, bindCertificate: mode };
  }

  // the refusals

  @Then("minting is refused as a key error {string}")
  mintingIsRefusedAsAKeyErrorUnder(code: string): void {
    const refusal = this.refusal();

    expect(refusal).toBeInstanceOf(AegisKeyError);
    expect(refusal).toMatchObject({ code });
  }
}
