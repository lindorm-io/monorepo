import type { DataTable } from "@lindorm/gherkin";
import { Binding, Given, ParameterType, Then, When } from "@lindorm/gherkin";
import { type IKryptos, KryptosKit, type KryptosSigAlgorithm } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { expect } from "vitest";
import { Aegis } from "../classes/Aegis.js";
import type { SignedToken } from "../types/index.js";
import type { RawDoorResult } from "../__fixtures__/aegis-context.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { alternationOf } from "../__fixtures__/alternation-of.js";
import type { Wire } from "../__fixtures__/raw-bucket.js";
import { OPAQUE_FORMAT, SEALED_FORMAT } from "../__fixtures__/wire-formats.js";

/** A producer's key is generated per scenario, so no vault can already hold it. */
const PRODUCER_KEYS = {
  "ES512 signing": () => KryptosKit.generate.sig.ec({ algorithm: "ES512" }),
  "HS256 signing": () => KryptosKit.generate.sig.oct({ algorithm: "HS256" }),
  "dir encryption": () => KryptosKit.generate.enc.oct({ algorithm: "dir" }),
} satisfies Record<string, () => IKryptos>;

type ProducerKey = keyof typeof PRODUCER_KEYS;

/** The id a reader files its copy of the producer's key under. */
const READERS_OWN_KEY_ID = "the-readers-own-key-id";

@Binding()
export class AegisCallerSuppliedKeyPolicySteps extends AegisStepsBase {
  // the verifier's key policy

  @Given("the verifier accepts only a signing key of the algorithm {string}")
  theVerifierAcceptsOnlyASigningKeyOfTheAlgorithm(algorithm: string): void {
    this.ctx.verifyOptions.key = {
      condition: { algorithm: algorithm as KryptosSigAlgorithm },
    };
  }

  // the producer outside the deployment

  @Given("the producer holds a(n) {producerKey} key the vault does not hold")
  theProducerHoldsAKey(key: ProducerKey): void {
    this.ctx.producerKey = PRODUCER_KEYS[key]();
  }

  // the key a reader supplies

  @Given("the verifier supplies the producer's key under a key id of its own")
  theVerifierSuppliesTheProducersKey(): void {
    this.ctx.verifyOptions.key = { kryptos: this.readersCopy() };
  }

  @Given("the deployment verifies with the producer's key under a key id of its own")
  theDeploymentVerifiesWithTheProducersKey(): void {
    this.ctx.aegis = new Aegis({
      amphora: this.ctx.amphora,
      logger: createMockLogger(),
      verify: { kryptos: this.readersCopy() },
    });
  }

  @Given("the recipient supplies the producer's key under a key id of its own")
  theRecipientSuppliesTheProducersKey(): void {
    this.ctx.decryptKey = { kryptos: this.readersCopy() };
  }

  // the producer's acts

  @When("the producer signs the wire claims as a claims token on the {wire} wire")
  async theProducerSignsTheWireClaims(wire: Wire): Promise<void> {
    this.assertScenarioWire(wire);

    this.keepSigned(await this.signClaims(wire, this.producerKey()));
  }

  @When("the producer signs the payload as opaque content on the {wire} wire")
  async theProducerSignsThePayloadAsOpaqueContent(wire: Wire): Promise<void> {
    this.assertScenarioWire(wire);
    const key = { kryptos: this.producerKey() };

    const signed =
      wire === "cose"
        ? await this.ctx.aegis.cws.sign(this.ctx.claims, { ...this.coseEnvelope(), key })
        : await this.ctx.aegis.jws.sign(this.ctx.claims, { ...this.joseEnvelope(), key });

    expect(signed.format).toBe(OPAQUE_FORMAT[wire]);

    this.keepSigned(signed);
  }

  @When("the producer encrypts the data on the {wire} wire")
  async theProducerEncryptsTheData(wire: Wire): Promise<void> {
    this.assertScenarioWire(wire);
    const format = SEALED_FORMAT[wire];

    const encrypted = await this.ctx.aegis.encrypt(this.ctx.claims, {
      format,
      key: { kryptos: this.producerKey() },
    });

    expect(encrypted.format).toBe(format);

    this.ctx.encrypted = encrypted;
    this.ctx.token = encrypted.token;
  }

  // the acts at the raw doors

  @When(
    "I verify the token as a claims token authenticated by a shared secret on the {wire} wire",
  )
  async iVerifyTheTokenAsAClaimsTokenAuthenticatedByASharedSecret(
    wire: Wire,
  ): Promise<void> {
    this.assertScenarioWire(wire);
    const token = this.token();
    const options = this.rawClaimsDoorOptions();

    expect(this.inspected().wire).toBe(wire);

    this.ctx.rawVerified = await this.attempt<RawDoorResult>(() =>
      wire === "cose"
        ? this.ctx.aegis.cwm.verify(token, undefined, options)
        : this.ctx.aegis.jwt.verify(token, undefined, options),
    );
  }

  @When("I decrypt the token as sealed content on the {wire} wire")
  async iDecryptTheTokenAsSealedContent(wire: Wire): Promise<void> {
    this.assertScenarioWire(wire);
    const token = this.token();
    const options = { key: this.ctx.decryptKey };

    expect(this.inspected().wire).toBe(wire);

    this.ctx.rawDecrypted = await this.attempt<RawDoorResult>(() =>
      wire === "cose"
        ? this.ctx.aegis.cwe.decrypt(token, options)
        : this.ctx.aegis.jwe.decrypt(token, options),
    );
  }

  // the raw decrypt door's result

  @Then("the raw decrypt door reports the payload")
  theRawDecryptDoorReportsThePayload(table: DataTable): void {
    const { payload } = this.rawDecrypted();

    expect(payload).toEqual(table.rowsHash());
  }

  // the refusals

  @Then("decryption is refused as a key error {string}")
  decryptionIsRefusedAsAKeyError(code: string): void {
    this.refusedAsAKeyError(code);
  }

  // parameter types

  @ParameterType("producerKey", alternationOf(Object.keys(PRODUCER_KEYS)))
  static producerKey(raw: string): ProducerKey {
    return raw as ProducerKey;
  }

  // helpers

  private producerKey(): IKryptos {
    const { producerKey } = this.ctx;

    if (producerKey !== undefined) return producerKey;

    throw new Error("no producer key was stated in this scenario");
  }

  /** The producer's key material under the reader's own id: the same key, another hint. */
  private readersCopy(): IKryptos {
    return KryptosKit.clone(this.producerKey(), { id: READERS_OWN_KEY_ID });
  }

  /**
   * The claims token the key admits: a JWT on JOSE whatever the key, and on COSE a
   * COSE_Mac0 under a shared secret, a COSE_Sign1 under a signing key pair.
   */
  private signClaims(wire: Wire, kryptos: IKryptos): Promise<SignedToken> {
    const key = { kryptos };

    if (wire === "jose") {
      return this.ctx.aegis.jwt.sign(this.ctx.wireClaims, {
        ...this.joseEnvelope(),
        key,
      });
    }

    return kryptos.algClass === "symmetric"
      ? this.ctx.aegis.cwm.sign(this.ctx.wireClaims, { ...this.coseEnvelope(), key })
      : this.ctx.aegis.cwt.sign(this.ctx.wireClaims, { ...this.coseEnvelope(), key });
  }

  private keepSigned(signed: SignedToken): void {
    this.ctx.signed = signed;
    this.ctx.token = signed.token;
  }
}
