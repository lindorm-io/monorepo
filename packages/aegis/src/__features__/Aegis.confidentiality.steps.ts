import type { DataTable, DocString } from "@lindorm/gherkin";
import { Binding, Given, Then, When } from "@lindorm/gherkin";
import { isObject } from "@lindorm/is";
import type { KryptosEncryption } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { Aegis } from "../classes/Aegis.js";
import { AegisError } from "../errors/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { TEST_OCT_KEY_ENC } from "../__fixtures__/keys.js";
import type { Wire } from "../__fixtures__/raw-bucket.js";
import { sealAsThirdParty } from "../__fixtures__/third-party-producer.js";
import { WIRE_ERROR, type WireError } from "../__fixtures__/wire-errors.js";
import { OPAQUE_FORMAT, SEALED_FORMAT } from "../__fixtures__/wire-formats.js";

@Binding()
export class AegisConfidentialitySteps extends AegisStepsBase {
  // the deployment

  @Given("the deployment's default content encryption is {string}")
  theDeploymentsDefaultContentEncryptionIs(encryption: KryptosEncryption): void {
    this.reconfigure(encryption);
  }

  @When("the deployment's default content encryption is changed to {string}")
  theDeploymentsDefaultContentEncryptionIsChangedTo(encryption: KryptosEncryption): void {
    this.reconfigure(encryption);
  }

  // the caller's statements

  @Given("the data to encrypt is the object")
  theDataToEncryptIsTheObject(object: DocString): void {
    this.ctx.claims = JSON.parse(object.content) as Dict;
  }

  @Given("the text to encrypt {string}")
  theTextToEncrypt(text: string): void {
    this.ctx.text = text;
  }

  @Given("the encrypt admits a content encryption COSE does not define")
  theEncryptAdmitsAContentEncryptionCoseDoesNotDefine(): void {
    this.ctx.encryptOptions.proprietary = true;
  }

  @Given("the payload to sign")
  thePayloadToSign(table: DataTable): void {
    this.ctx.claims = table.rowsHash();
  }

  // the acts

  @When("I encrypt the text on the {wire} wire")
  async iEncryptTheText(wire: Wire): Promise<void> {
    this.assertScenarioWire(wire);
    const format = SEALED_FORMAT[wire];
    const { text } = this.ctx;

    if (text === undefined) {
      throw new Error("no text to encrypt was stated in this scenario");
    }

    const encrypted = await this.attempt(() => this.ctx.aegis.encrypt(text, { format }));

    if (encrypted === undefined) return;

    expect(encrypted.format).toBe(format);

    this.ctx.encrypted = encrypted;
    this.ctx.token = encrypted.token;
  }

  @When("I sign the payload as opaque content on the {wire} wire")
  async iSignThePayloadAsOpaqueContent(wire: Wire): Promise<void> {
    this.assertScenarioWire(wire);
    const format = OPAQUE_FORMAT[wire];

    const signed = await this.attempt(() =>
      format === "cws"
        ? this.ctx.aegis.cws.sign(this.ctx.claims, this.coseEnvelope())
        : this.ctx.aegis.jws.sign(this.ctx.claims, this.joseEnvelope()),
    );

    if (signed === undefined) return;

    expect(signed.format).toBe(format);

    this.ctx.signed = signed;
    this.ctx.token = signed.token;
  }

  @When("a third party seals the data on the {wire} wire, typed {string}")
  async aThirdPartySealsTheData(wire: Wire, typ: string): Promise<void> {
    this.assertScenarioWire(wire);
    this.ctx.token = await sealAsThirdParty(
      wire,
      Buffer.from(JSON.stringify(this.ctx.claims), "utf8"),
      typ,
      TEST_OCT_KEY_ENC,
    );
  }

  @When("I decrypt the token")
  async iDecryptTheToken(): Promise<void> {
    const token = this.token();

    this.ctx.decrypted = await this.attempt(() =>
      this.ctx.aegis.decrypt(token, {
        critical: this.ctx.verifyOptions.critical,
        key: this.ctx.decryptKey,
      }),
    );
  }

  // the domain result

  @Then("the decrypted token is a {string}")
  theDecryptedTokenIsA(format: string): void {
    expect(this.decrypted().format).toBe(format);
  }

  @Then("the decrypted payload carries {string} {string}")
  theDecryptedPayloadCarries(key: string, value: string): void {
    expect(this.decryptedObject()[key]).toBe(value);
  }

  @Then("the decrypted payload carries {string} as the list {stringList}")
  theDecryptedPayloadCarriesAsTheList(key: string, members: Array<string>): void {
    expect(this.decryptedObject()[key]).toEqual(members);
  }

  @Then("the decrypted payload carries no {string}")
  theDecryptedPayloadCarriesNo(key: string): void {
    expect(this.decryptedObject()).not.toHaveProperty(key);
  }

  @Then("the decrypted payload is exactly the object")
  theDecryptedPayloadIsExactlyTheObject(object: DocString): void {
    expect(this.decrypted().payload).toEqual(JSON.parse(object.content));
  }

  @Then("the decrypted payload is the text {string}")
  theDecryptedPayloadIsTheText(text: string): void {
    expect(this.decrypted().payload).toBe(text);
  }

  @Then("the decrypted header reports the token type {string}")
  theDecryptedHeaderReportsTheTokenType(tokenType: string): void {
    expect(this.decrypted().header.tokenType).toBe(tokenType);
  }

  // the refusals

  @Then("decryption is refused as an aegis error")
  decryptionIsRefusedAsAnAegisError(): void {
    expect(this.refusal()).toBeInstanceOf(AegisError);
  }

  @Then("decryption is refused as a {wireError} error {string}")
  decryptionIsRefusedAsAWireError(error: WireError, code: string): void {
    const refusal = this.refusal();

    expect(refusal).toBeInstanceOf(WIRE_ERROR[error]);
    expect(refusal).toMatchObject({ code });
  }

  // helpers

  /**
   * A setting is a constructor argument, so the deployment is built again around
   * the vault the feature already stocked — the same keys, another default.
   */
  private reconfigure(defaultEncryption: KryptosEncryption): void {
    this.ctx.aegis = new Aegis({
      amphora: this.ctx.amphora,
      logger: createMockLogger(),
      defaultEncryption,
    });
  }

  /** The decrypted payload, which the sentence expects to be an object. */
  private decryptedObject(): Dict {
    const { payload } = this.decrypted();

    if (isObject(payload)) return payload;

    throw new Error("the decrypted payload is not an object");
  }
}
