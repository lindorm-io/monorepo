import { Amphora } from "@lindorm/amphora";
import type { DataTable } from "@lindorm/gherkin";
import { Binding, Given, ParameterType, Then, When } from "@lindorm/gherkin";
import type { IKryptos } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { expect } from "vitest";
import { Aegis } from "../classes/Aegis.js";
import type { TokenType } from "../constants/token-type.js";
import { AegisStepsBase } from "../__fixtures__/aegis-steps-base.js";
import { alternationOf } from "../__fixtures__/alternation-of.js";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_EC_KEY_SIG_CERT,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../__fixtures__/keys.js";
import type { Wire, WireKey } from "../__fixtures__/raw-bucket.js";
import { SEALED_FORMAT, SIGNED_FORMAT } from "../__fixtures__/wire-formats.js";

const VAULT_KEYS = {
  "ES512 signing": TEST_EC_KEY_SIG,
  "HS256 signing": TEST_OCT_KEY_SIG,
  "certificate-bearing ES256 signing": TEST_EC_KEY_SIG_CERT,
  "ECDH-ES encryption": TEST_EC_KEY_ENC,
  "dir encryption": TEST_OCT_KEY_ENC,
} satisfies Record<string, IKryptos>;

type VaultKey = keyof typeof VAULT_KEYS;

/** The claims the domain states as a list, and a sentence may name. */
const LIST_CLAIMS = ["audience", "scope", "roles"] as const;

type ListClaim = (typeof LIST_CLAIMS)[number];

/** `"name"` for a JOSE member; `claim key N` for a CWT claim; `label N` for a COSE header. */
const WIRE_KEY = /"[^"]*"|claim key -?\d+|label -?\d+/;
const WIRE_KEY_LIST = new RegExp(`(?:${WIRE_KEY.source})(?:, (?:${WIRE_KEY.source}))*`);

const toWireKey = (raw: string): WireKey =>
  raw.startsWith('"') ? raw.slice(1, -1) : Number(raw.slice(raw.lastIndexOf(" ") + 1));

// RFC 7515 §4.1.9: a recipient treats a value without "/" as "application/"-prefixed.
const declaredMediaType = (typ: string): string =>
  typ.includes("/") ? typ : `application/${typ}`;

@Binding()
export class AegisProfileLessSteps extends AegisStepsBase {
  // the deployment

  @Given("the clock reads {string}")
  theClockReads(instant: string): void {
    MockDate.set(new Date(instant));
  }

  @Given("a deployment at {string} whose vault holds a(n) {vaultKey} key")
  async aDeployment(issuer: string, key: VaultKey): Promise<void> {
    const logger = createMockLogger();
    const amphora = new Amphora({ internal: { issuer }, logger });

    await amphora.setup();
    amphora.add(VAULT_KEYS[key]);

    this.ctx.amphora = amphora;
    this.ctx.aegis = new Aegis({ amphora, logger });
  }

  @Given("the vault also holds a(n) {vaultKey} key")
  theVaultAlsoHolds(key: VaultKey): void {
    this.ctx.amphora.add(VAULT_KEYS[key]);
  }

  // the caller's statements

  @Given("the claims to sign")
  theClaimsToSign(table: DataTable): void {
    this.ctx.claims = table.rowsHash();
  }

  @Given("the data to encrypt")
  theDataToEncrypt(table: DataTable): void {
    this.ctx.claims = table.rowsHash();
  }

  @Given("the claims expire at {string}")
  theClaimsExpireAt(instant: string): void {
    this.ctx.claims.expiresAt = new Date(instant);
  }

  @Given("a(n) {listClaim} list whose only member is {string}")
  aListWhoseOnlyMemberIs(claim: ListClaim, member: string): void {
    this.ctx.claims[claim] = [member];
  }

  @Given("the token type {string}")
  theTokenType(tokenType: TokenType): void {
    this.ctx.tokenType = tokenType;
  }

  @Given("the type header {string}")
  theTypeHeader(typ: string): void {
    this.ctx.typ = typ;
  }

  // the acts

  @When("I sign the claims without a profile on the {wire} wire")
  async iSignTheClaims(wire: Wire): Promise<void> {
    const format = SIGNED_FORMAT[wire];

    const signed = await this.attempt(() =>
      this.ctx.aegis.sign({
        format,
        payload: this.ctx.claims,
        tokenType: this.ctx.tokenType,
        typ: this.ctx.typ,
        ...this.domainEnvelope(),
      }),
    );

    if (signed === undefined) return;

    // The sentence names the wire; the artifact must be that wire's claims format.
    expect(signed.format).toBe(format);

    this.ctx.signed = signed;
    this.ctx.token = signed.token;
  }

  @When("I verify the token")
  async iVerifyTheToken(): Promise<void> {
    const token = this.token();

    this.ctx.verified = await this.attempt(() =>
      this.ctx.aegis.verify(token, this.ctx.assert, this.ctx.verifyOptions),
    );
  }

  @When("I encrypt the data on the {wire} wire")
  async iEncryptTheData(wire: Wire): Promise<void> {
    await this.encrypt(wire, undefined);
  }

  @When("I encrypt the data on the {wire} wire with the party producer {string}")
  async iEncryptTheDataWithThePartyProducer(
    wire: Wire,
    partyProducer: string,
  ): Promise<void> {
    await this.encrypt(wire, partyProducer);
  }

  // the raw wire, read off the bytes

  @Then("the raw payload carries {wireKey} {string}")
  theRawPayloadCarries(key: WireKey, value: string): void {
    expect(this.raw("payload").get(key)).toBe(value);
  }

  @Then("the raw payload carries {wireKey} as the byte string {string}")
  theRawPayloadCarriesAsTheByteString(key: WireKey, text: string): void {
    const value = this.raw("payload").get(key);

    expect(value).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(value as Uint8Array).toString("utf8")).toBe(text);
  }

  @Then("the raw payload carries no {wireKey}")
  theRawPayloadCarriesNo(key: WireKey): void {
    expect(this.raw("payload").has(key), `the raw payload carries ${String(key)}`).toBe(
      false,
    );
  }

  @Then("the raw payload carries none of {wireKeys}")
  theRawPayloadCarriesNoneOf(keys: Array<WireKey>): void {
    const payload = this.raw("payload");

    for (const key of keys) {
      expect(payload.has(key), `the raw payload carries ${String(key)}`).toBe(false);
    }
  }

  @Then("the raw protected header carries {wireKey} {string}")
  theRawProtectedHeaderCarries(key: WireKey, value: string): void {
    expect(this.raw("protectedHeader").get(key)).toBe(value);
  }

  @Then("the raw protected header declares the media type {string}")
  theRawProtectedHeaderDeclaresTheMediaType(mediaType: string): void {
    const typ = this.raw("protectedHeader").get("typ");

    expect(typ).toBeTypeOf("string");
    expect(declaredMediaType(typ as string)).toBe(declaredMediaType(mediaType));
  }

  @Then("the raw protected header carries a text string at label {int}")
  theRawProtectedHeaderCarriesATextStringAtLabel(label: number): void {
    expect(this.raw("protectedHeader").get(label)).toBeTypeOf("string");
  }

  @Then("the raw unprotected header carries no {wireKey}")
  theRawUnprotectedHeaderCarriesNo(key: WireKey): void {
    expect(
      this.raw("unprotectedHeader").has(key),
      `the raw unprotected header carries ${String(key)}`,
    ).toBe(false);
  }

  // the domain result

  @Then("the verified token is a {string}")
  theVerifiedTokenIsA(format: string): void {
    expect(this.verified().format).toBe(format);
  }

  @Then("the verified token reports the wrapper {string}")
  theVerifiedTokenReportsTheWrapper(wrapper: string): void {
    expect(this.verified().wrapper).toBe(wrapper);
  }

  @Then("the verified claims include")
  theVerifiedClaimsInclude(table: DataTable): void {
    expect(this.verified().claims).toMatchObject(table.rowsHash());
  }

  @Then("the sealed token is a {string}")
  theSealedTokenIsA(format: string): void {
    expect(this.encrypted().format).toBe(format);
  }

  @Then("the sealed token reports no wrapper")
  theSealedTokenReportsNoWrapper(): void {
    expect(this.encrypted()).not.toHaveProperty("wrapper");
  }

  // the refusals

  @Then("signing is refused as a domain error {string}")
  signingIsRefusedAsADomainError(code: string): void {
    this.refusedAsADomainError(code);
  }

  @Then("encryption is refused as a domain error")
  encryptionIsRefusedAsADomainError(): void {
    this.refusedAsADomainError(undefined);
  }

  @Then("the refusal names the claim {string} and locates the fault at {string}: {}")
  theRefusalNamesTheClaim(claim: string, key: string, message: string): void {
    expect(this.refusal()).toMatchObject({
      data: { claim, invalid: [{ key, message }] },
    });
  }

  @Then("the refusal reports format {string}, operation {string} and option {string}")
  theRefusalReports(format: string, operation: string, option: string): void {
    expect(this.refusal()).toMatchObject({ data: { format, operation, option } });
  }

  // parameter types

  @ParameterType("wire", alternationOf(["jose", "cose"]))
  static wire(raw: string): Wire {
    return raw as Wire;
  }

  @ParameterType("vaultKey", alternationOf(Object.keys(VAULT_KEYS)))
  static vaultKey(raw: string): VaultKey {
    return raw as VaultKey;
  }

  @ParameterType("listClaim", alternationOf(LIST_CLAIMS))
  static listClaim(raw: string): ListClaim {
    return raw as ListClaim;
  }

  @ParameterType("wireKey", WIRE_KEY)
  static wireKey(raw: string): WireKey {
    return toWireKey(raw);
  }

  @ParameterType("wireKeys", WIRE_KEY_LIST)
  static wireKeys(raw: string): Array<WireKey> {
    return (raw.match(new RegExp(WIRE_KEY.source, "g")) ?? []).map(toWireKey);
  }

  // helpers

  private async encrypt(wire: Wire, partyProducer: string | undefined): Promise<void> {
    const format = SEALED_FORMAT[wire];

    const encrypted = await this.attempt(() =>
      this.ctx.aegis.encrypt(this.ctx.claims, {
        format,
        partyProducer,
        type: this.ctx.tokenType,
        ...this.domainEnvelope(),
      }),
    );

    if (encrypted === undefined) return;

    expect(encrypted.format).toBe(format);

    this.ctx.encrypted = encrypted;
    this.ctx.token = encrypted.token;
  }
}
