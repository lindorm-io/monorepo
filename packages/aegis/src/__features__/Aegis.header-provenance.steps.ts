import { Binding, Then } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisError } from "../errors/index.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { RawPart, WireKey } from "../__fixtures__/raw-bucket.js";

@Binding()
export class AegisHeaderProvenanceSteps extends AegisStepsBase {
  // the raw wire, read off the bytes

  @Then("the raw protected header carries no {wireKey}")
  theRawProtectedHeaderCarriesNo(key: WireKey): void {
    this.carriesNoneOf("protectedHeader", [key]);
  }

  @Then("the raw protected header carries all of {wireKeys}")
  theRawProtectedHeaderCarriesAllOf(keys: Array<WireKey>): void {
    this.carriesAllOf("protectedHeader", keys);
  }

  @Then("the raw protected header carries none of {wireKeys}")
  theRawProtectedHeaderCarriesNoneOf(keys: Array<WireKey>): void {
    this.carriesNoneOf("protectedHeader", keys);
  }

  @Then("the raw protected header carries {wireKey} as the integer {int}")
  theRawProtectedHeaderCarriesAsTheInteger(key: WireKey, value: number): void {
    expect(this.raw("protectedHeader").get(key)).toBe(value);
  }

  @Then(
    "the raw protected header carries {wireKey} as the byte string {string} in base64url",
  )
  theRawProtectedHeaderCarriesAsTheByteStringInBase64url(
    key: WireKey,
    base64url: string,
  ): void {
    this.carriesTheByteString("protectedHeader", key, base64url);
  }

  @Then("the raw unprotected header carries {wireKey} {string}")
  theRawUnprotectedHeaderCarries(key: WireKey, value: string): void {
    expect(this.raw("unprotectedHeader").get(key)).toBe(value);
  }

  @Then("the raw unprotected header carries {wireKey} as the list {stringList}")
  theRawUnprotectedHeaderCarriesAsTheList(key: WireKey, members: Array<string>): void {
    expect(this.raw("unprotectedHeader").get(key)).toEqual(members);
  }

  @Then(
    "the raw unprotected header carries {wireKey} as the byte string {string} in base64url",
  )
  theRawUnprotectedHeaderCarriesAsTheByteStringInBase64url(
    key: WireKey,
    base64url: string,
  ): void {
    this.carriesTheByteString("unprotectedHeader", key, base64url);
  }

  @Then(
    "the raw unprotected header carries {wireKey} as the byte string of the text {string}",
  )
  theRawUnprotectedHeaderCarriesAsTheByteStringOfTheText(
    key: WireKey,
    text: string,
  ): void {
    expect(this.byteStringAt("unprotectedHeader", key).toString("utf8")).toBe(text);
  }

  @Then("the raw unprotected header carries all of {wireKeys}")
  theRawUnprotectedHeaderCarriesAllOf(keys: Array<WireKey>): void {
    this.carriesAllOf("unprotectedHeader", keys);
  }

  @Then("the raw unprotected header carries none of {wireKeys}")
  theRawUnprotectedHeaderCarriesNoneOf(keys: Array<WireKey>): void {
    this.carriesNoneOf("unprotectedHeader", keys);
  }

  // the domain result

  @Then("the verified header reports no token type")
  theVerifiedHeaderReportsNoTokenType(): void {
    expect(this.verified().header.tokenType).toBeUndefined();
  }

  @Then("the verified header reports the token type {string}")
  theVerifiedHeaderReportsTheTokenType(tokenType: string): void {
    expect(this.verified().header.tokenType).toBe(tokenType);
  }

  @Then("the verified header reports the header type {string}")
  theVerifiedHeaderReportsTheHeaderType(headerType: string): void {
    expect(this.verified().header.headerType).toBe(headerType);
  }

  @Then("the verified header reports the content type {string}")
  theVerifiedHeaderReportsTheContentType(contentType: string): void {
    expect(this.verified().header.contentType).toBe(contentType);
  }

  @Then("the verified header reports the key id of the ES512 signing key")
  theVerifiedHeaderReportsTheKeyIdOfTheSigningKey(): void {
    expect(this.verified().header.keyId).toBe(TEST_EC_KEY_SIG.id);
  }

  // the refusals

  @Then("signing is refused as an aegis error {string}")
  signingIsRefusedAsAnAegisError(code: string): void {
    const refusal = this.refusal();

    expect(refusal).toBeInstanceOf(AegisError);
    expect(refusal).toMatchObject({ code });
  }

  @Then("the refusal names the parameter {string} in the bucket {string}")
  theRefusalNamesTheParameterInTheBucket(parameter: string, bucket: string): void {
    expect(this.refusalData()).toEqual({ parameter, bucket });
  }

  @Then("the refusal names the parameter {string} under the empty-value ruling {string}")
  theRefusalNamesTheParameterUnderTheEmptyValueRuling(
    parameter: string,
    whenEmpty: string,
  ): void {
    expect(this.refusalData()).toEqual({ parameter, whenEmpty });
  }

  // helpers

  private carriesAllOf(part: RawPart, keys: Array<WireKey>): void {
    const bucket = this.raw(part);

    for (const key of keys) {
      expect(bucket.has(key), `the raw ${part} carries no ${String(key)}`).toBe(true);
    }
  }

  private carriesTheByteString(part: RawPart, key: WireKey, base64url: string): void {
    expect(this.byteStringAt(part, key).toString("base64url")).toBe(base64url);
  }

  private byteStringAt(part: RawPart, key: WireKey): Buffer {
    const value = this.raw(part).get(key);

    expect(value).toBeInstanceOf(Uint8Array);

    return Buffer.from(value as Uint8Array);
  }

  private carriesNoneOf(part: RawPart, keys: Array<WireKey>): void {
    const bucket = this.raw(part);

    for (const key of keys) {
      expect(bucket.has(key), `the raw ${part} carries ${String(key)}`).toBe(false);
    }
  }
}
