import { Binding, Given, ParameterType, Then, When } from "@lindorm/gherkin";
import type { KryptosAlgClass } from "@lindorm/kryptos";
import { expect } from "vitest";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { alternationOf } from "../__fixtures__/alternation-of.js";
import { alterToken, type TokenPart } from "../__fixtures__/altered-token.js";
import { TEST_OCT_KEY_SIG } from "../__fixtures__/keys.js";
import type { Wire } from "../__fixtures__/raw-bucket.js";
import { signAsThirdParty } from "../__fixtures__/third-party-producer.js";

/** The parts of a signed token a holder can alter, as a sentence names them. */
const TOKEN_PARTS = ["protected header", "payload", "signature"] as const;

/** The two classes a key can belong to, as a selector or a floor names them. */
const ALG_CLASSES = ["asymmetric", "symmetric"] as const;

@Binding()
export class AegisSignatureProofSteps extends AegisStepsBase {
  // the mint's key policy

  @Given("the mint selects a signing key of the {algClass} class")
  theMintSelectsASigningKeyOfTheClass(algClass: KryptosAlgClass): void {
    this.ctx.mintOptions.sign = {
      ...this.ctx.mintOptions.sign,
      key: { condition: { algClass } },
    };
  }

  // the acts

  @When("the {tokenPart} of the token is altered after it was issued")
  theTokenPartIsAlteredAfterItWasIssued(part: TokenPart): void {
    this.ctx.token = alterToken(this.token(), part);
  }

  @When(
    "a third party authenticates the wire claims with the shared secret on the {wire} wire, typed {string}",
  )
  async aThirdPartyAuthenticatesTheWireClaimsWithTheSharedSecret(
    wire: Wire,
    typ: string,
  ): Promise<void> {
    this.ctx.token = await signAsThirdParty(
      wire,
      this.ctx.wireClaims,
      typ,
      TEST_OCT_KEY_SIG,
      this.ctx.foreignHeaders,
    );
  }

  @When(
    "I mint the content under the {string} profile as a MAC-authenticated claims token",
  )
  async iMintTheContentAsAMacAuthenticatedClaimsToken(profile: string): Promise<void> {
    const minted = await this.attempt(() =>
      this.ctx.aegis.mint(profile, this.mintContent(), {
        ...this.ctx.mintOptions,
        format: "cwm",
        sign: { ...this.ctx.mintOptions.sign, ...this.domainEnvelope() },
      }),
    );

    if (minted === undefined) return;

    // The sentence names the MAC-authenticated form; the artifact must be it.
    expect(minted.format).toBe("cwm");

    this.ctx.signed = minted;
    this.ctx.token = minted.token;
  }

  // the refusals

  @Then("the refusal reports the algorithm it read {string}")
  theRefusalReportsTheAlgorithmItRead(algorithm: string): void {
    expect(this.refusal()).toMatchObject({ data: { algorithm } });
  }

  // parameter types

  @ParameterType("tokenPart", alternationOf(TOKEN_PARTS))
  static tokenPart(raw: string): TokenPart {
    return raw as TokenPart;
  }

  @ParameterType("algClass", alternationOf(ALG_CLASSES))
  static algClass(raw: string): KryptosAlgClass {
    return raw as KryptosAlgClass;
  }
}
