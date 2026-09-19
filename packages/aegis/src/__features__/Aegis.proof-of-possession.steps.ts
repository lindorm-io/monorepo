import type { DataTable, DocString } from "@lindorm/gherkin";
import { Binding, Given, ParameterType, Then, When } from "@lindorm/gherkin";
import { isObject } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { CoseError, CwtError, JoseError, JwtError } from "../errors/index.js";
import type { ParsedDpopProof } from "../types/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { alternationOf } from "../__fixtures__/alternation-of.js";
import {
  accessTokenHashOf,
  jwkThumbprintOf,
  signDpopProofAsPresenter,
  type DpopProofStatement,
} from "../__fixtures__/dpop-presenter.js";
import { jsonCells } from "../__fixtures__/json-cells.js";
import {
  TEST_EC_KEY_SIG,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_SIG,
} from "../__fixtures__/keys.js";

/**
 * The keys a presenter may hold, named by algorithm. Only the ES512 one is a
 * vault resident: a verifier learns a presenter's key from the proof's own
 * `jwk` header (RFC 9449 §4.2) and from nowhere else.
 */
const PRESENTER_KEYS = {
  EdDSA: TEST_OKP_KEY_SIG,
  RS512: TEST_RSA_KEY_SIG,
  ES512: TEST_EC_KEY_SIG,
} satisfies Record<string, IKryptos>;

type PresenterKey = keyof typeof PRESENTER_KEYS;

/** The wire error a mint refuses under, by the same names `{wireError}` binds elsewhere. */
const WIRE_ERROR = {
  JOSE: JoseError,
  COSE: CoseError,
  JWT: JwtError,
  CWT: CwtError,
} as const;

type WireError = keyof typeof WIRE_ERROR;

/** An access token this proof was never presented with — the replay a committed `ath` exists to stop. */
const ANOTHER_ACCESS_TOKEN = "an-access-token-this-proof-was-not-presented-with";

@Binding()
export class AegisProofOfPossessionSteps extends AegisStepsBase {
  // the caller's statements

  @Given("the confirmation claim is the object")
  theConfirmationClaimIsTheObject(object: DocString): void {
    this.ctx.claims.confirmation = JSON.parse(object.content) as Dict;
  }

  @Given("the content binds the token to the {presenterKey} presenter key")
  async theContentBindsTheTokenToThePresenterKey(key: PresenterKey): Promise<void> {
    this.ctx.claims.confirmation = {
      thumbprint: await jwkThumbprintOf(PRESENTER_KEYS[key]),
    };
  }

  // the presenter's statements

  @Given("a proof identified {string} for the request {string} {string}")
  aProofIdentifiedForTheRequest(
    tokenId: string,
    httpMethod: string,
    httpUri: string,
  ): void {
    this.ctx.proofStatement = { tokenId, httpMethod, httpUri };
  }

  @Given("the proof header carries")
  theProofHeaderCarries(table: DataTable): void {
    this.ctx.proofHeader = jsonCells(table);
  }

  // the verifier's statements

  @Given("the verifier vouches that the binding was proven upstream")
  theVerifierVouchesThatTheBindingWasProvenUpstream(): void {
    this.ctx.verifyOptions.trustBoundThumbprint = true;
  }

  // the acts

  @When(
    "the presenter signs the proof with the {presenterKey} presenter key over the presented token",
  )
  async thePresenterSignsTheProofOverThePresentedToken(key: PresenterKey): Promise<void> {
    await this.presentProof(key, this.token());
  }

  @When(
    "the presenter signs the proof with the {presenterKey} presenter key over another access token",
  )
  async thePresenterSignsTheProofOverAnotherAccessToken(
    key: PresenterKey,
  ): Promise<void> {
    await this.presentProof(key, ANOTHER_ACCESS_TOKEN);
  }

  // the domain result

  @Then(
    "the verified proof reports the identifier {string} for the request {string} {string}",
  )
  theVerifiedProofReportsTheIdentifierForTheRequest(
    tokenId: string,
    httpMethod: string,
    httpUri: string,
  ): void {
    expect(this.verifiedProof()).toMatchObject({ tokenId, httpMethod, httpUri });
  }

  @Then("the verified proof's thumbprint is the one the raw payload's confirmation names")
  theVerifiedProofsThumbprintIsTheOneTheRawPayloadsConfirmationNames(): void {
    const cnf = this.raw("payload").get("cnf");

    if (!isObject(cnf)) {
      throw new Error(
        "the raw payload carries no confirmation object to read a thumbprint off",
      );
    }

    const jkt = cnf.jkt;

    expect(jkt, "the raw confirmation names no thumbprint").toBeTypeOf("string");
    expect(this.verifiedProof().thumbprint).toBe(jkt);
  }

  @Then("the verified proof's access token hash is the SHA-256 of the presented token")
  theVerifiedProofsAccessTokenHashIsTheSha256OfThePresentedToken(): void {
    expect(this.verifiedProof().accessTokenHash).toBe(accessTokenHashOf(this.token()));
  }

  // the refusals

  @Then("minting is refused as a {wireError} error {string}")
  mintingIsRefusedAsAWireError(error: WireError, code: string): void {
    const refusal = this.refusal();

    expect(refusal).toBeInstanceOf(WIRE_ERROR[error]);
    expect(refusal).toMatchObject({ code });
  }

  @Then("the refusal lists the unrepresentable members {stringList}")
  theRefusalListsTheUnrepresentableMembers(members: Array<string>): void {
    expect(this.refusal()).toMatchObject({ data: { members } });
  }

  @Then("the refusal reports the format {string} and names the member {string}")
  theRefusalReportsTheFormatAndNamesTheMember(format: string, member: string): void {
    expect(this.refusal()).toMatchObject({ data: { format, member } });
  }

  // parameter types

  @ParameterType("presenterKey", alternationOf(Object.keys(PRESENTER_KEYS)))
  static presenterKey(raw: string): PresenterKey {
    return raw as PresenterKey;
  }

  // helpers

  /** Sign the stated proof over `accessToken` and hand it to the next verify. */
  private async presentProof(key: PresenterKey, accessToken: string): Promise<void> {
    this.ctx.verifyOptions.dpopProof = await signDpopProofAsPresenter(
      PRESENTER_KEYS[key],
      this.statedProof(),
      accessToken,
      this.ctx.proofHeader,
    );
  }

  private statedProof(): DpopProofStatement {
    if (this.ctx.proofStatement !== undefined) return this.ctx.proofStatement;

    throw new Error("no proof was stated in this scenario");
  }

  /** The proof the verify reported; a verify handed none reports none, and that is a failed premise. */
  private verifiedProof(): ParsedDpopProof {
    const { dpop } = this.verified();

    if (dpop !== undefined) return dpop;

    throw new Error("the verified result carries no proof of possession");
  }
}
