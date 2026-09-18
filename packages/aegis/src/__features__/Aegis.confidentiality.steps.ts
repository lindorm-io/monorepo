import type { DataTable, DocString } from "@lindorm/gherkin";
import { Binding, Given, Then, When } from "@lindorm/gherkin";
import { isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { expect } from "vitest";
import { AegisError } from "../errors/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import type { Wire } from "../__fixtures__/raw-bucket.js";
import { OPAQUE_FORMAT, SEALED_FORMAT } from "../__fixtures__/wire-formats.js";

@Binding()
export class AegisConfidentialitySteps extends AegisStepsBase {
  // the caller's statements

  @Given("the data to encrypt is the object")
  theDataToEncryptIsTheObject(object: DocString): void {
    this.ctx.claims = JSON.parse(object.content) as Dict;
  }

  @Given("the text to encrypt {string}")
  theTextToEncrypt(text: string): void {
    this.ctx.text = text;
  }

  @Given("the payload to sign")
  thePayloadToSign(table: DataTable): void {
    this.ctx.claims = table.rowsHash();
  }

  // the acts

  @When("I encrypt the text on the {wire} wire")
  async iEncryptTheText(wire: Wire): Promise<void> {
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
    const format = OPAQUE_FORMAT[wire];

    const signed = await this.attempt(() =>
      format === "cws"
        ? this.ctx.aegis.cws.sign(this.ctx.claims)
        : this.ctx.aegis.jws.sign(this.ctx.claims),
    );

    if (signed === undefined) return;

    expect(signed.format).toBe(format);

    this.ctx.signed = signed;
    this.ctx.token = signed.token;
  }

  @When("I decrypt the token")
  async iDecryptTheToken(): Promise<void> {
    const token = this.token();

    this.ctx.decrypted = await this.attempt(() => this.ctx.aegis.decrypt(token));
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

  // helpers

  /** The decrypted payload, which the sentence expects to be an object. */
  private decryptedObject(): Dict {
    const { payload } = this.decrypted();

    if (isObject(payload)) return payload;

    throw new Error("the decrypted payload is not an object");
  }
}
