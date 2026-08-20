import { B64 } from "@lindorm/b64";
import { Binding, Given, ParameterType, Then, When } from "@lindorm/gherkin";
import { isBuffer, isString } from "@lindorm/is";
import type { IKryptos, KryptosEncryption, OctEncAlgorithm } from "@lindorm/kryptos";
import {
  KryptosKit,
  OCT_ENC_DIR_ALGORITHMS,
  OCT_ENC_STD_ALGORITHMS,
} from "@lindorm/kryptos";
import { AES_ENCRYPTION_ALGORITHMS } from "@lindorm/types";
import { expect } from "vitest";
import { AesKit } from "../classes/AesKit.js";
import { AesError } from "../errors/index.js";
import { AES_CBOR_KIT } from "../internal/constants/cbor-spec.js";
import type { AesContentEncryption } from "../interfaces/index.js";
import type {
  AesContent,
  AesEncryptionMode,
  AesEncryptionRecord,
  SerialisedAesEncryption,
} from "../types/index.js";
import { TEST_EC_KEY, TEST_OKP_KEY } from "./keys.js";

@Binding()
export class AesKitSteps {
  private kryptos!: IKryptos;
  private kit!: AesKit;
  private cipher!: string | AesEncryptionRecord | SerialisedAesEncryption;
  private expected!: AesContent;
  private plainBytes!: Buffer;
  private seal!: AesContentEncryption;
  private secondSeal!: AesContentEncryption;
  private fixedNonce!: Buffer;

  // keys

  @Given('an oct key with algorithm "{algorithm}" and encryption "{encryption}"')
  anOctKey(algorithm: OctEncAlgorithm, encryption: KryptosEncryption): void {
    this.kryptos = KryptosKit.generate.enc.oct({ algorithm, encryption });
    this.kit = new AesKit({ kryptos: this.kryptos });
  }

  @Given("an oct key that declares no encryption")
  anOctKeyThatDeclaresNoEncryption(): void {
    // `enc` is not a JWK member, so a key imported from a peer's JWKS carries
    // no declaration — the case `AesKitSettings.defaultEncryption` exists for.
    const generated = KryptosKit.generate.enc.oct({
      algorithm: "A256KW",
      encryption: "A128GCM",
    });

    this.kryptos = KryptosKit.from.jwk({ ...generated.toJWK("private"), enc: undefined });

    expect(this.kryptos.encryption).toBeNull();

    this.kit = new AesKit({ kryptos: this.kryptos });
  }

  @Given("an {agreementKey} key for ECDH-ES key agreement")
  anAgreementKey(kryptos: IKryptos): void {
    this.kryptos = kryptos;
    this.kit = new AesKit({ kryptos });
  }

  @Given('the kit falls back to encryption "{encryption}"')
  theKitFallsBackToEncryption(encryption: KryptosEncryption): void {
    this.kit = new AesKit({ kryptos: this.kryptos, defaultEncryption: encryption });
  }

  // encrypt

  @When("I encrypt {string}")
  iEncrypt(content: string): void {
    this.expected = content;
    this.cipher = this.kit.encrypt(content);
  }

  @When("I encrypt the JSON value {json}")
  iEncryptTheJsonValue(value: AesContent): void {
    this.expected = value;
    this.cipher = this.kit.encrypt(value);
  }

  @When("I encrypt the bytes {string}")
  iEncryptTheBytes(content: string): void {
    this.expected = Buffer.from(content, "utf8");
    this.cipher = this.kit.encrypt(this.expected);
  }

  @When("I encrypt {string} in {mode} mode")
  iEncryptInMode(content: string, mode: AesEncryptionMode): void {
    this.expected = content;

    switch (mode) {
      case "cbor":
        this.cipher = this.kit.encrypt(content, "cbor");
        break;

      case "record":
        this.cipher = this.kit.encrypt(content, "record");
        break;

      case "serialised":
        this.cipher = this.kit.encrypt(content, "serialised");
        break;

      default: {
        const exhaustive: never = mode;
        throw new Error(`unhandled encryption mode "${String(exhaustive)}"`);
      }
    }
  }

  @When('I encrypt {string} in record mode with aad "{bytes}"')
  iEncryptInRecordModeWithAad(content: string, aad: Buffer): void {
    this.expected = content;
    this.cipher = this.kit.encrypt(content, "record", { aad });
  }

  @When('I encrypt {string} in {mode} mode with apu "{bytes}" and apv "{bytes}"')
  iEncryptInModeWithPartyInfo(
    content: string,
    mode: AesEncryptionMode,
    apu: Buffer,
    apv: Buffer,
  ): void {
    this.expected = content;

    switch (mode) {
      case "cbor":
        this.cipher = this.kit.encrypt(content, "cbor", { apu, apv });
        break;

      case "record":
        this.cipher = this.kit.encrypt(content, "record", { apu, apv });
        break;

      case "serialised":
        this.cipher = this.kit.encrypt(content, "serialised", { apu, apv });
        break;

      default: {
        const exhaustive: never = mode;
        throw new Error(`unhandled encryption mode "${String(exhaustive)}"`);
      }
    }
  }

  @When("the ciphertext is tampered with")
  theCiphertextIsTamperedWith(): void {
    const record = this.cipher as AesEncryptionRecord;

    expect(isBuffer(record.content)).toBe(true);

    record.content[0] ^= 0xff;
  }

  @When("the cipher's header is tampered with")
  theCiphersHeaderIsTamperedWith(): void {
    // The tampered field is the key id: `decryptAes` never reads it
    // (encryption.ts), so the ONLY thing that can reject the mutation is the
    // auth check over the header-derived AAD (cbor-aes.ts header re-encode,
    // serialised-aes.ts computeAad).
    if (isString(this.cipher)) {
      const bytes = B64.toBuffer(this.cipher.slice(4), "b64u");
      const decoded = AES_CBOR_KIT.decode(new Uint8Array(bytes));

      decoded.keyId = `${decoded.keyId}-tampered`;

      this.cipher = `aes:${B64.encode(Buffer.from(AES_CBOR_KIT.encode(decoded)), "b64u")}`;
      return;
    }

    const record = this.cipher as SerialisedAesEncryption;
    const header = JSON.parse(B64.toBuffer(record.header, "b64u").toString("utf8"));

    header.kid = `${header.kid}-tampered`;

    record.header = B64.encode(Buffer.from(JSON.stringify(header), "utf8"), "b64u");
  }

  // decrypt

  @Then("decrypting returns {string}")
  decryptingReturns(expected: string): void {
    expect(this.kit.decrypt(this.cipher)).toBe(expected);
  }

  @Then("decrypting returns the same value")
  decryptingReturnsTheSameValue(): void {
    expect(this.kit.decrypt(this.cipher)).toEqual(this.expected);
  }

  @Then('decrypting with aad "{bytes}" returns {string}')
  decryptingWithAadReturns(aad: Buffer, expected: string): void {
    expect(this.kit.decrypt(this.cipher, { aad })).toBe(expected);
  }

  @Then('decrypting with aad "{bytes}" is rejected')
  decryptingWithAadIsRejected(aad: Buffer): void {
    let caught: unknown;

    try {
      this.kit.decrypt(this.cipher, { aad });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AesError);
    expect(caught).toMatchObject({ code: this.authFailureCode() });
  }

  @Then("decrypting without an aad is rejected")
  decryptingWithoutAnAadIsRejected(): void {
    this.decryptingIsRejected();
  }

  @Then("decrypting is rejected")
  decryptingIsRejected(): void {
    let caught: unknown;

    try {
      this.kit.decrypt(this.cipher);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AesError);
    expect(caught).toMatchObject({ code: this.authFailureCode() });
  }

  // An auth failure surfaces per cipher family: CBC-HMAC compares the tag
  // itself and throws "auth_tag_verification_failed" (auth-tag-hmac.ts), which
  // AesKit.decrypt re-throws unwrapped; the AEAD ciphers fail inside node
  // crypto and AesKit.decrypt wraps that as "decryption_failed" (AesKit.ts).
  private authFailureCode(): string {
    return AesKit.parse(this.cipher).encryption.includes("CBC-HS")
      ? "auth_tag_verification_failed"
      : "decryption_failed";
  }

  // verify / assert

  @Then("verifying {string} returns true")
  verifyingReturnsTrue(content: string): void {
    expect(this.kit.verify(content, this.cipher)).toBe(true);
  }

  @Then("verifying {string} returns false")
  verifyingReturnsFalse(content: string): void {
    expect(this.kit.verify(content, this.cipher)).toBe(false);
  }

  @Then('verifying {string} with aad "{bytes}" returns true')
  verifyingWithAadReturnsTrue(content: string, aad: Buffer): void {
    expect(this.kit.verify(content, this.cipher, { aad })).toBe(true);
  }

  @Then("asserting {string} passes")
  assertingPasses(content: string): void {
    expect(() => this.kit.assert(content, this.cipher)).not.toThrow();
  }

  @Then("asserting {string} is rejected")
  assertingIsRejected(content: string): void {
    let caught: unknown;

    try {
      this.kit.assert(content, this.cipher);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AesError);
    expect(caught).toMatchObject({ code: "invalid_cipher" });
  }

  @Then("encrypting in {word} mode is rejected as an unknown mode")
  encryptingInUnknownModeIsRejected(mode: string): void {
    let caught: unknown;

    try {
      // The cast smuggles the raw word past the compile-time overloads so it
      // reaches the runtime mode switch (AesKit.encrypt default branch).
      this.kit.encrypt("payload", mode as "cbor");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AesError);
    expect(caught).toMatchObject({ code: "invalid_encryption_mode" });
  }

  // parsed cipher

  @Then('the parsed cipher carries apu "{bytes}" and apv "{bytes}"')
  theParsedCipherCarriesPartyInfo(apu: Buffer, apv: Buffer): void {
    const parsed = AesKit.parse(this.cipher);

    expect(parsed.apu).toEqual(apu);
    expect(parsed.apv).toEqual(apv);
  }

  @Then("the parsed cipher carries no apu and no apv")
  theParsedCipherCarriesNoPartyInfo(): void {
    const parsed = AesKit.parse(this.cipher);

    expect(parsed.apu).toBeUndefined();
    expect(parsed.apv).toBeUndefined();
  }

  @Then('the cipher declares encryption "{encryption}"')
  theCipherDeclaresEncryption(encryption: KryptosEncryption): void {
    expect(AesKit.parse(this.cipher).encryption).toBe(encryption);
  }

  @Then("the record carries a {int}-byte nonce and a {int}-byte tag")
  theRecordCarriesSizes(nonceBytes: number, tagBytes: number): void {
    const record = this.cipher as AesEncryptionRecord;

    expect(record.initialisationVector.length).toBe(nonceBytes);
    expect(record.authTag.length).toBe(tagBytes);
  }

  // content primitive

  @When("I seal the bytes {string}")
  iSealTheBytes(content: string): void {
    this.plainBytes = Buffer.from(content, "utf8");
    this.seal = this.kit.encryptContent(this.plainBytes);
  }

  @When('I seal the bytes {string} with aad "{bytes}"')
  iSealTheBytesWithAad(content: string, aad: Buffer): void {
    this.plainBytes = Buffer.from(content, "utf8");
    this.seal = this.kit.encryptContent(this.plainBytes, { aad });
  }

  @When('I seal the bytes {string} twice with aad "{bytes}" and a fixed {int}-byte nonce')
  iSealTheBytesTwiceWithFixedNonce(
    content: string,
    aad: Buffer,
    nonceBytes: number,
  ): void {
    this.plainBytes = Buffer.from(content, "utf8");
    this.fixedNonce = Buffer.alloc(nonceBytes, 7);
    this.seal = this.kit.encryptContent(this.plainBytes, { aad, iv: this.fixedNonce });
    this.secondSeal = this.kit.encryptContent(this.plainBytes, {
      aad,
      iv: this.fixedNonce,
    });
  }

  @When('a peer with the same secret seals {string} under "{encryption}"')
  aPeerWithTheSameSecretSeals(content: string, encryption: KryptosEncryption): void {
    const peer = KryptosKit.from.jwk({
      ...this.kryptos.toJWK("private"),
      enc: encryption,
    });

    this.plainBytes = Buffer.from(content, "utf8");
    this.seal = new AesKit({ kryptos: peer }).encryptContent(this.plainBytes);
  }

  @Then('unsealing as "{encryption}" returns the bytes')
  unsealingAsReturnsTheBytes(encryption: KryptosEncryption): void {
    const unsealed = this.kit.decryptContent({
      ciphertext: this.seal.ciphertext,
      encryption,
      iv: this.seal.iv,
      tag: this.seal.tag,
    });

    expect(unsealed).toEqual(this.plainBytes);
  }

  @Then('unsealing as "{encryption}" with aad "{bytes}" returns the bytes')
  unsealingAsWithAadReturnsTheBytes(encryption: KryptosEncryption, aad: Buffer): void {
    const unsealed = this.kit.decryptContent({
      aad,
      ciphertext: this.seal.ciphertext,
      encryption,
      iv: this.seal.iv,
      tag: this.seal.tag,
    });

    expect(unsealed).toEqual(this.plainBytes);
  }

  @Then('unsealing as "{encryption}" with aad "{bytes}" is rejected')
  unsealingAsWithAadIsRejected(encryption: KryptosEncryption, aad: Buffer): void {
    let caught: unknown;

    try {
      this.kit.decryptContent({
        aad,
        ciphertext: this.seal.ciphertext,
        encryption,
        iv: this.seal.iv,
        tag: this.seal.tag,
      });
    } catch (error) {
      caught = error;
    }

    // The AEAD tag check throws inside node crypto and AesKit.decryptContent
    // wraps it (AesKit.ts catch: code "decryption_failed").
    expect(caught).toBeInstanceOf(AesError);
    expect(caught).toMatchObject({ code: "decryption_failed" });
  }

  @Then("both seals carry identical ciphertext and tag")
  bothSealsCarryIdenticalCiphertextAndTag(): void {
    expect(this.seal.ciphertext.equals(this.secondSeal.ciphertext)).toBe(true);
    expect(this.seal.tag.equals(this.secondSeal.tag)).toBe(true);
    expect(this.seal.iv.equals(this.fixedNonce)).toBe(true);
  }

  @Then("the seal carries a {int}-byte tag")
  theSealCarriesTag(tagBytes: number): void {
    expect(this.seal.tag.length).toBe(tagBytes);
  }

  @Then("sealing bytes is rejected")
  sealingBytesIsRejected(): void {
    let caught: unknown;

    try {
      this.kit.encryptContent(Buffer.from("payload", "utf8"));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AesError);
    expect(caught).toMatchObject({ code: "content_primitive_requires_direct_key" });
  }

  // static helpers

  @Then("the content type of the JSON value {json} is {string}")
  theContentTypeOfTheJsonValueIs(value: AesContent, contentType: string): void {
    expect(AesKit.contentType(value)).toBe(contentType);
  }

  @Then("the content type of the bytes {string} is {string}")
  theContentTypeOfTheBytesIs(content: string, contentType: string): void {
    expect(AesKit.contentType(Buffer.from(content, "utf8"))).toBe(contentType);
  }

  @Then("the cipher is recognised as an AES string")
  theCipherIsRecognisedAsAnAesString(): void {
    expect(AesKit.isAesString(this.cipher)).toBe(true);
  }

  @Then("{string} is not recognised as an AES string")
  isNotRecognisedAsAnAesString(value: string): void {
    expect(AesKit.isAesString(value)).toBe(false);
  }

  @Then("parsing the record returns it unchanged")
  parsingTheRecordReturnsItUnchanged(): void {
    expect(AesKit.parse(this.cipher)).toEqual(this.cipher);
  }

  // parameter types

  @ParameterType("algorithm", /[A-Za-z0-9+-]+/)
  static algorithm(raw: string): OctEncAlgorithm {
    const found = [...OCT_ENC_DIR_ALGORITHMS, ...OCT_ENC_STD_ALGORITHMS].find(
      (algorithm) => algorithm === raw,
    );

    if (found) {
      return found;
    }

    throw new Error(`unknown oct encryption algorithm "${raw}"`);
  }

  @ParameterType("encryption", /[A-Za-z0-9-]+/)
  static encryption(raw: string): KryptosEncryption {
    const found = AES_ENCRYPTION_ALGORITHMS.find((encryption) => encryption === raw);

    if (found) {
      return found;
    }

    throw new Error(`unknown content encryption "${raw}"`);
  }

  @ParameterType("bytes", /[A-Za-z0-9-]+/)
  static bytes(raw: string): Buffer {
    return Buffer.from(raw, "utf8");
  }

  @ParameterType("json", /\S+/)
  static json(raw: string): AesContent {
    return JSON.parse(raw) as AesContent;
  }

  // AesEncryptionMode is a bare union (aes-decryption-data.ts) with no shipped
  // const array, so the regexp is the closed list and the switch narrows it.
  @ParameterType("mode", /cbor|record|serialised/)
  static mode(raw: string): AesEncryptionMode {
    switch (raw) {
      case "cbor":
      case "record":
      case "serialised":
        return raw;

      default:
        throw new Error(`unknown encryption mode "${raw}"`);
    }
  }

  @ParameterType("agreementKey", /EC|OKP/)
  static agreementKey(raw: string): IKryptos {
    return raw === "EC" ? TEST_EC_KEY : TEST_OKP_KEY;
  }
}
