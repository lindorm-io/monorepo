import { B64 } from "@lindorm/b64";
import { Binding, DataTable, Given, ParameterType, Then, When } from "@lindorm/gherkin";
import { AES_ENCRYPTION_ALGORITHMS, type Environment } from "@lindorm/types";
import { decode, encode } from "cbor2";
import { X509Certificate } from "crypto";
import { expect } from "vitest";
import { KryptosKit } from "../classes/KryptosKit.js";
import type { IKryptos } from "../interfaces/index.js";
import {
  AKP_SIG_ALGORITHMS,
  EC_CURVES,
  EC_ENC_ALGORITHMS,
  EC_SIG_ALGORITHMS,
  KRYPTOS_ALGORITHMS,
  KRYPTOS_ENC_ALGORITHMS,
  KRYPTOS_SIG_ALGORITHMS,
  OCT_ENC_DIR_ALGORITHMS,
  OCT_ENC_STD_ALGORITHMS,
  OCT_SIG_ALGORITHMS,
  OKP_ENC_ALGORITHMS,
  OKP_ENC_CURVES,
  OKP_SIG_ALGORITHMS,
  OKP_SIG_CURVES,
  RSA_ENC_ALGORITHMS,
  RSA_MODULUS,
  RSA_SIG_ALGORITHMS,
} from "../types/index.js";
import type {
  KryptosAlgorithm,
  KryptosCurve,
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosEnvFormat,
  KryptosFrom,
  KryptosFromBuffer,
  KryptosFromJwk,
  KryptosFromString,
  KryptosLike,
  KryptosSigAlgorithm,
  KryptosType,
  KryptosUse,
} from "../types/index.js";
import { TEST_AKP_KEY_B64, TEST_AKP_KEY_JWK, TEST_AKP_KEY_PEM } from "./akp-keys.js";
import { TEST_EC_KEY_B64, TEST_EC_KEY_JWK, TEST_EC_KEY_PEM } from "./ec-keys.js";
import type { KeyFormat, Subject } from "./kryptos-steps-base.js";
import { KryptosStepsBase } from "./kryptos-steps-base.js";
import {
  TEST_OCT_KEY_B64,
  TEST_OCT_KEY_JWK,
  TEST_OCT_KEY_PEM,
  TEST_OCT_KEY_UTF,
} from "./oct-keys.js";
import { TEST_OKP_KEY_B64, TEST_OKP_KEY_JWK, TEST_OKP_KEY_PEM } from "./okp-keys.js";
import { TEST_RSA_KEY_B64, TEST_RSA_KEY_JWK, TEST_RSA_KEY_PEM } from "./rsa-keys.js";
import {
  TEST_X509_EXPIRED_PEM,
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_PEM,
  TEST_X509_LEAF_PRIVATE_KEY_B64,
  TEST_X509_LEAF_PUBLIC_KEY_B64,
  TEST_X509_ROOT_PEM,
} from "./x509.js";

type NonKey = null | undefined | string | number;

type GenerateOptions = Pick<
  KryptosLike,
  | "id"
  | "createdAt"
  | "notBefore"
  | "expiresAt"
  | "issuer"
  | "jwksUri"
  | "ownerId"
  | "purpose"
  | "encryption"
  | "publish"
>;

type Fixture = {
  b64: KryptosFromString;
  jwk: KryptosFromJwk;
  pem: KryptosFromString;
};

const FIXTURES: Record<KryptosType, Fixture> = {
  AKP: { b64: TEST_AKP_KEY_B64, jwk: TEST_AKP_KEY_JWK, pem: TEST_AKP_KEY_PEM },
  EC: { b64: TEST_EC_KEY_B64, jwk: TEST_EC_KEY_JWK, pem: TEST_EC_KEY_PEM },
  oct: { b64: TEST_OCT_KEY_B64, jwk: TEST_OCT_KEY_JWK, pem: TEST_OCT_KEY_PEM },
  OKP: { b64: TEST_OKP_KEY_B64, jwk: TEST_OKP_KEY_JWK, pem: TEST_OKP_KEY_PEM },
  RSA: { b64: TEST_RSA_KEY_B64, jwk: TEST_RSA_KEY_JWK, pem: TEST_RSA_KEY_PEM },
};

const KEY_ID = /^key_[A-Za-z0-9]{16}$/;

// RFC 7517 §4.9
const X5T_S256_BASE64URL_LENGTH = 43;
const X5T_S256 = new RegExp(`^[A-Za-z0-9_-]{${X5T_S256_BASE64URL_LENGTH}}$`);

const CBOR_MAP_HEADER_RANGE = { min: 0xa0, max: 0xbb };
const JSON_OBJECT_OPENING_BRACE = 0x7b;

const CA_NOT_BEFORE = new Date("2026-01-01T00:00:00.000Z");
const CA_EXPIRES_AT = new Date("2046-01-01T00:00:00.000Z");

const pick = <T extends string>(list: ReadonlyArray<T>, raw: string, what: string): T => {
  const found = list.find((item) => item === raw);

  if (found) {
    return found;
  }

  throw new Error(`unknown ${what} "${raw}"`);
};

const derFixture = (b64: KryptosFromString): KryptosFromBuffer => ({
  ...b64,
  privateKey: b64.privateKey ? B64.toBuffer(b64.privateKey, "b64u") : undefined,
  publicKey: b64.publicKey ? B64.toBuffer(b64.publicKey, "b64u") : undefined,
});

const readOptions = (table: DataTable): GenerateOptions => {
  const rows = table.rowsHash();
  const options: GenerateOptions = {};

  for (const [name, value] of Object.entries(rows)) {
    switch (name) {
      case "id":
      case "issuer":
      case "jwksUri":
      case "ownerId":
      case "purpose":
        options[name] = value;
        break;

      case "createdAt":
      case "notBefore":
      case "expiresAt":
        options[name] = new Date(value);
        break;

      case "encryption":
        options.encryption = pick(AES_ENCRYPTION_ALGORITHMS, value, "content encryption");
        break;

      case "publish":
        options.publish = pick(["true", "false"] as const, value, "boolean") === "true";
        break;

      default:
        throw new Error(`unknown generation option "${name}"`);
    }
  }

  return options;
};

@Binding()
export class KryptosKitSteps extends KryptosStepsBase {
  private fixture!: Fixture;
  private input!: KryptosFrom;
  private options!: GenerateOptions;
  private snapshot!: ReturnType<IKryptos["toDB"]>;
  private candidate!: unknown;

  // generate

  @Given('a generated "{algorithm}" key')
  aGeneratedKey(algorithm: KryptosAlgorithm): void {
    this.ctx.kryptos = KryptosKit.generate.auto({ algorithm });
  }

  @Given('a generated "{algorithm}" key that is {published}')
  aGeneratedKeyThatIs(algorithm: KryptosAlgorithm, publish: boolean): void {
    this.ctx.kryptos = KryptosKit.generate.auto({ algorithm, publish });
  }

  @Given('another generated "{algorithm}" key')
  anotherGeneratedKey(algorithm: KryptosAlgorithm): void {
    this.ctx.other = KryptosKit.generate.auto({ algorithm });
  }

  @Given('a generated "{algorithm}" key with a {int}-bit modulus')
  aGeneratedKeyWithAModulus(algorithm: KryptosAlgorithm, bits: number): void {
    const modulus = RSA_MODULUS.find((size) => size === bits);

    if (modulus) {
      this.ctx.kryptos = KryptosKit.generate.auto({ algorithm, modulus });
      return;
    }

    throw new Error(`unknown RSA modulus "${bits}"`);
  }

  @Given("the fixture leaf key with its full certificate chain")
  theFixtureLeafKeyWithItsFullCertificateChain(): void {
    this.ctx.kryptos = KryptosKit.from.b64({
      algorithm: "ES256",
      curve: "P-256",
      type: "EC",
      use: "sig",
      privateKey: TEST_X509_LEAF_PRIVATE_KEY_B64,
      publicKey: TEST_X509_LEAF_PUBLIC_KEY_B64,
      certificateChain: [
        TEST_X509_LEAF_PEM,
        TEST_X509_INTERMEDIATE_PEM,
        TEST_X509_ROOT_PEM,
      ],
    });
  }

  @Given("the fixture expired key with its certificate chain")
  theFixtureExpiredKeyWithItsCertificateChain(): void {
    // The fixture ships no private key for the expired certificate, so the
    // public half is read off the certificate itself.
    const { x, y } = new X509Certificate(TEST_X509_EXPIRED_PEM).publicKey.export({
      format: "jwk",
    });

    this.ctx.kryptos = KryptosKit.from.jwk({
      alg: "ES256",
      crv: "P-256",
      kty: "EC",
      use: "sig",
      x,
      y,
      x5c: [TEST_X509_EXPIRED_PEM, TEST_X509_ROOT_PEM].map((pem) => this.unwrapPem(pem)),
    });
  }

  @When('I generate a signing key of type "{keyType}" with algorithm "{sigAlgorithm}"')
  iGenerateASigningKey(type: KryptosType, algorithm: KryptosSigAlgorithm): void {
    this.ctx.kryptos = this.generateSig(type, algorithm);
  }

  @When(
    'I generate an encryption key of type "{keyType}" with algorithm "{encAlgorithm}"',
  )
  iGenerateAnEncryptionKey(type: KryptosType, algorithm: KryptosEncAlgorithm): void {
    this.ctx.kryptos = this.generateEnc(type, algorithm);
  }

  @When(
    'I generate a "{use}" key of type "OKP" with algorithm "{algorithm}" on curve "{curve}"',
  )
  iGenerateAnOkpKeyOnCurve(
    use: KryptosUse,
    algorithm: KryptosAlgorithm,
    curve: KryptosCurve,
  ): void {
    switch (use) {
      case "sig":
        this.ctx.kryptos = KryptosKit.generate.sig.okp({
          algorithm: pick(OKP_SIG_ALGORITHMS, algorithm, "OKP signing algorithm"),
          curve: pick(OKP_SIG_CURVES, curve, "OKP signing curve"),
        });
        break;

      case "enc":
        this.ctx.kryptos = KryptosKit.generate.enc.okp({
          algorithm: pick(OKP_ENC_ALGORITHMS, algorithm, "OKP encryption algorithm"),
          curve: pick(OKP_ENC_CURVES, curve, "OKP encryption curve"),
        });
        break;

      default: {
        const exhaustive: never = use;
        throw new Error(`unhandled use "${String(exhaustive)}"`);
      }
    }
  }

  @When('I generate a key automatically for algorithm "{algorithm}"')
  iGenerateAKeyAutomatically(algorithm: KryptosAlgorithm): void {
    this.ctx.kryptos = KryptosKit.generate.auto({ algorithm });
  }

  @When('I asynchronously generate a key automatically for algorithm "{algorithm}"')
  async iAsynchronouslyGenerateAKeyAutomatically(
    algorithm: KryptosAlgorithm,
  ): Promise<void> {
    this.ctx.kryptos = await KryptosKit.generateAsync.auto({ algorithm });
  }

  @When(
    'I asynchronously generate a signing key of type "{keyType}" with algorithm "{sigAlgorithm}"',
  )
  async iAsynchronouslyGenerateASigningKey(
    type: KryptosType,
    algorithm: KryptosSigAlgorithm,
  ): Promise<void> {
    this.ctx.kryptos = await this.generateSigAsync(type, algorithm);
  }

  @When(
    'I asynchronously generate an encryption key of type "{keyType}" with algorithm "{encAlgorithm}"',
  )
  async iAsynchronouslyGenerateAnEncryptionKey(
    type: KryptosType,
    algorithm: KryptosEncAlgorithm,
  ): Promise<void> {
    this.ctx.kryptos = await this.generateEncAsync(type, algorithm);
  }

  @When('I generate an "{algorithm}" key valid from {string}')
  iGenerateAKeyValidFrom(algorithm: KryptosAlgorithm, notBefore: string): void {
    this.ctx.kryptos = KryptosKit.generate.auto({
      algorithm,
      notBefore: new Date(notBefore),
    });
  }

  @When('I generate an "{algorithm}" key with the options')
  iGenerateAKeyWithTheOptions(algorithm: KryptosAlgorithm, table: DataTable): void {
    this.options = readOptions(table);
    this.ctx.kryptos = KryptosKit.generate.auto({ algorithm, ...this.options });
  }

  // generate: refusals

  @Then("generating an EC signing key with the algorithm {string} is refused as {string}")
  generatingAnEcSigningKeyWithTheAlgorithmIsRefused(
    algorithm: string,
    code: string,
  ): void {
    // The cast smuggles a non-EC algorithm past the option types so it reaches
    // the runtime curve resolution (ec/get-curve.ts default branch).
    this.refused(code, () =>
      KryptosKit.generate.sig.ec({ algorithm: algorithm as "ES256" }),
    );
  }

  @Then(
    "generating an AKP signing key with the algorithm {string} is refused as {string}",
  )
  generatingAnAkpSigningKeyWithTheAlgorithmIsRefused(
    algorithm: string,
    code: string,
  ): void {
    this.refused(code, () =>
      KryptosKit.generate.sig.akp({ algorithm: algorithm as "ML-DSA-44" }),
    );
  }

  @Then(
    "generating a key automatically for the unknown algorithm {string} is refused as {string}",
  )
  generatingAutomaticallyForUnknownAlgorithmIsRefused(
    algorithm: string,
    code: string,
  ): void {
    this.refused(code, () =>
      KryptosKit.generate.auto({ algorithm: algorithm as KryptosAlgorithm }),
    );
  }

  @Then(
    "resolving the key type for the unknown algorithm {string} is refused as {string}",
  )
  resolvingTheKeyTypeForUnknownAlgorithmIsRefused(algorithm: string, code: string): void {
    this.refused(code, () =>
      KryptosKit.getTypeForAlgorithm(algorithm as KryptosAlgorithm),
    );
  }

  // import

  @Given("the {keyType} fixture key")
  theFixtureKey(type: KryptosType): void {
    this.fixture = FIXTURES[type];
  }

  @When("I import it with from.{format}")
  iImportItWith(format: KeyFormat): void {
    switch (format) {
      case "b64":
        this.input = this.fixture.b64;
        this.ctx.kryptos = KryptosKit.from.b64(this.fixture.b64);
        break;

      case "der": {
        const der = derFixture(this.fixture.b64);

        this.input = der;
        this.ctx.kryptos = KryptosKit.from.der(der);
        break;
      }

      case "jwk":
        this.input = this.fixture.jwk;
        this.ctx.kryptos = KryptosKit.from.jwk(this.fixture.jwk);
        break;

      case "pem":
        this.input = this.fixture.pem;
        this.ctx.kryptos = KryptosKit.from.pem(this.fixture.pem);
        break;

      default: {
        const exhaustive: never = format;
        throw new Error(`unhandled key format "${String(exhaustive)}"`);
      }
    }
  }

  @When("I import it again by detection")
  iImportItAgainByDetection(): void {
    this.ctx.other = KryptosKit.from.auto(this.input);
  }

  @When("I import the oct fixture secret as UTF-8")
  iImportTheOctFixtureSecretAsUtf8(): void {
    this.ctx.kryptos = KryptosKit.from.utf(TEST_OCT_KEY_UTF);
  }

  @When(
    'I derive an "{algorithm}" key from the passphrase {string} along the path {string}',
  )
  iDeriveAKeyFromThePassphrase(
    algorithm: KryptosAlgorithm,
    passphrase: string,
    path: string,
  ): void {
    this.ctx.kryptos = KryptosKit.from.derive({
      algorithm,
      deriveFrom: passphrase,
      path,
      type: "oct",
      use: "sig",
    });
  }

  @When(
    'I derive another "{algorithm}" key from the passphrase {string} along the path {string}',
  )
  iDeriveAnotherKeyFromThePassphrase(
    algorithm: KryptosAlgorithm,
    passphrase: string,
    path: string,
  ): void {
    this.ctx.other = KryptosKit.from.derive({
      algorithm,
      deriveFrom: passphrase,
      path,
      type: "oct",
      use: "sig",
    });
  }

  @When(
    'I derive an "{algorithm}" key from the passphrase {string} along the path {string} with id {string}',
  )
  iDeriveAKeyFromThePassphraseWithId(
    algorithm: KryptosAlgorithm,
    passphrase: string,
    path: string,
    id: string,
  ): void {
    this.ctx.kryptos = KryptosKit.from.derive({
      algorithm,
      deriveFrom: passphrase,
      id,
      path,
      type: "oct",
      use: "sig",
    });
  }

  @When('I derive an "{algorithm}" key from it along the path {string}')
  iDeriveAKeyFromIt(algorithm: KryptosAlgorithm, path: string): void {
    this.ctx.other = KryptosKit.from.derive({
      algorithm,
      deriveFrom: this.ctx.kryptos,
      path,
      type: "oct",
      use: "sig",
    });
  }

  @Then("deriving again from it along the path {string} reproduces the derived key")
  derivingAgainFromItReproducesTheDerivedKey(path: string): void {
    const again = KryptosKit.from.derive({
      algorithm: this.ctx.other.algorithm,
      deriveFrom: this.ctx.kryptos,
      path,
      type: "oct",
      use: "sig",
    });

    expect(again.id).toBe(this.ctx.other.id);
    expect(again.export("der").privateKey).toEqual(
      this.ctx.other.export("der").privateKey,
    );
  }

  @When("I restore the key from its database row")
  iRestoreTheKeyFromItsDatabaseRow(): void {
    this.ctx.other = KryptosKit.from.db(this.ctx.kryptos.toDB());
  }

  @When("I import its private JWK")
  iImportItsPrivateJwk(): void {
    this.ctx.other = KryptosKit.from.jwk(this.ctx.kryptos.toJWK("private"));
  }

  @When("I import its private JWK as our own")
  iImportItsPrivateJwkAsOurOwn(): void {
    this.ctx.other = KryptosKit.from.jwk(this.ctx.kryptos.toJWK("private"), true);
  }

  @When("I import its private JWK as foreign")
  iImportItsPrivateJwkAsForeign(): void {
    this.ctx.other = KryptosKit.from.jwk(this.ctx.kryptos.toJWK("private"), false);
  }

  @When("I import its private JWK carrying an internal flag")
  iImportItsPrivateJwkCarryingAnInternalFlag(): void {
    const planted = { ...this.ctx.kryptos.toJWK("private"), internal: true };

    this.ctx.other = KryptosKit.from.jwk(planted);
  }

  @When("I import its private JWK carrying publish false")
  iImportItsPrivateJwkCarryingPublishFalse(): void {
    const planted = { ...this.ctx.kryptos.toJWK("private"), publish: false };

    this.ctx.other = KryptosKit.from.jwk(planted);
  }

  @When("I import its private JWK without a kid")
  iImportItsPrivateJwkWithoutAKid(): void {
    const { kid, ...jwk } = this.ctx.kryptos.toJWK("private");

    void kid;
    this.ctx.other = KryptosKit.from.jwk(jwk);
  }

  @When("I import its public JWK")
  iImportItsPublicJwk(): void {
    this.ctx.other = KryptosKit.from.jwk(this.ctx.kryptos.toJWK("public"));
  }

  @When("I import its public JWK with kid {string}")
  iImportItsPublicJwkWithKid(kid: string): void {
    this.ctx.other = KryptosKit.from.jwk({ ...this.ctx.kryptos.toJWK("public"), kid });
  }

  // import: assertions and refusals

  @Then("importing the key's own JWK export reproduces it")
  importingTheKeysOwnJwkExportReproducesIt(): void {
    const reimported = KryptosKit.from.jwk(this.ctx.kryptos.export("jwk"));

    expect(reimported.id).toBe(this.ctx.kryptos.id);
    expect(reimported.export("jwk")).toEqual(this.ctx.kryptos.export("jwk"));
  }

  @Then("importing its public JWK without a kid reproduces the id")
  importingItsPublicJwkWithoutAKidReproducesTheId(): void {
    const { kid, ...jwk } = this.ctx.kryptos.toJWK("public");

    void kid;
    expect(KryptosKit.from.jwk(jwk).id).toBe(this.ctx.kryptos.id);
  }

  @Then("importing its private PEM without an id reproduces the id")
  importingItsPrivatePemWithoutAnIdReproducesTheId(): void {
    const { id, ...pem } = this.ctx.kryptos.export("pem");

    void id;
    expect(KryptosKit.from.pem(pem).id).toBe(this.ctx.kryptos.id);
  }

  @Then("importing its private JWK without a kid again yields yet another id")
  importingItsPrivateJwkWithoutAKidAgainYieldsYetAnotherId(): void {
    const { kid, ...jwk } = this.ctx.kryptos.toJWK("private");

    void kid;
    const again = KryptosKit.from.jwk(jwk);

    expect(again.id).not.toBe(this.ctx.kryptos.id);
    expect(again.id).not.toBe(this.ctx.other.id);
  }

  @Then("importing {string} by detection is refused as {string}")
  importingByDetectionIsRefused(value: string, code: string): void {
    this.refused(code, () => KryptosKit.from.auto(value));
  }

  @Then("importing the EC fixture PEM without its {member} is refused as {string}")
  importingTheEcFixturePemWithoutIsRefused(
    member: "algorithm" | "type" | "use",
    code: string,
  ): void {
    const pem: Partial<KryptosFromString> = { ...TEST_EC_KEY_PEM };

    delete pem[member];

    this.refused(code, () => KryptosKit.from.pem(pem as KryptosFromString));
  }

  @Then(
    "importing its public JWK with a tampered certificate thumbprint is refused as {string}",
  )
  importingItsPublicJwkWithATamperedCertificateThumbprintIsRefused(code: string): void {
    const tampered = {
      ...this.ctx.kryptos.toJWK("public"),
      "x5t#S256": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };

    this.refused(code, () => KryptosKit.from.jwk(tampered));
  }

  // env

  @When("I export it as an env string")
  iExportItAsAnEnvString(): void {
    this.ctx.serialised = KryptosKit.env.export(this.ctx.kryptos);
  }

  @When('I export it as a "{envFormat}" env string')
  iExportItAsAFormatEnvString(format: KryptosEnvFormat): void {
    this.ctx.serialised = KryptosKit.env.export(this.ctx.kryptos, format);
  }

  @When("I import the env string")
  iImportTheEnvString(): void {
    this.ctx.other = KryptosKit.env.import(this.ctx.serialised);
  }

  @Then("the env string payload is {payload}")
  theEnvStringPayloadIs(isPayload: (first: number) => boolean): void {
    expect(this.ctx.serialised.startsWith("kryptos:")).toBe(true);

    const payload = B64.toBuffer(this.ctx.serialised.slice("kryptos:".length), "b64u");

    expect(isPayload(payload[0])).toBe(true);
  }

  @Then("the imported key matches the key's id, thumbprint and publish flag")
  theImportedKeyMatchesTheKeysIdThumbprintAndPublishFlag(): void {
    expect({
      id: this.ctx.other.id,
      thumbprint: this.ctx.other.thumbprint,
      publish: this.ctx.other.publish,
    }).toEqual({
      id: this.ctx.kryptos.id,
      thumbprint: this.ctx.kryptos.thumbprint,
      publish: this.ctx.kryptos.publish,
    });
  }

  @Then("importing the env string {string} is refused as {string}")
  importingTheEnvStringIsRefused(value: string, code: string): void {
    this.refused(code, () => KryptosKit.env.import(value));
  }

  @Then("importing a prefixed env string with an opaque payload is refused as {string}")
  importingAPrefixedEnvStringWithAnOpaquePayloadIsRefused(code: string): void {
    const opaque = "kryptos:" + B64.encode(Buffer.from([0x01, 0x02, 0x03]), "b64u");

    this.refused(code, () => KryptosKit.env.import(opaque));
  }

  @Then("importing a CBOR env string declaring version {int} is refused as {string}")
  importingACborEnvStringDeclaringVersionIsRefused(version: number, code: string): void {
    this.refused(code, () => KryptosKit.env.import(this.tamperedCborEnv(0, version)));
  }

  @Then(
    "importing a CBOR env string carrying the unknown label {int} is refused as {string}",
  )
  importingACborEnvStringCarryingTheUnknownLabelIsRefused(
    label: number,
    code: string,
  ): void {
    this.refused(code, () => KryptosKit.env.import(this.tamperedCborEnv(label, "x")));
  }

  // clone

  @When("I clone the key")
  iCloneTheKey(): void {
    this.snapshot = this.ctx.kryptos.toDB();
    this.ctx.other = KryptosKit.clone(this.ctx.kryptos);
  }

  @When("I clone the key overwriting")
  iCloneTheKeyOverwriting(table: DataTable): void {
    this.snapshot = this.ctx.kryptos.toDB();
    this.ctx.other = KryptosKit.clone(this.ctx.kryptos, readOptions(table));
  }

  @Then("the key's database row is unchanged")
  theKeysDatabaseRowIsUnchanged(): void {
    expect(this.ctx.kryptos.toDB()).toEqual(this.snapshot);
  }

  // certificates

  @Given("a root CA key")
  aRootCaKey(): void {
    this.rootCa({});
  }

  @Given("a root CA key with path length {int}")
  aRootCaKeyWithPathLength(pathLengthConstraint: number): void {
    this.rootCa({ pathLengthConstraint });
  }

  @Given("a root CA key in the {string} environment")
  aRootCaKeyInTheEnvironment(environment: string): void {
    this.rootCa({ environment: this.environment(environment), pathLengthConstraint: 1 });
  }

  @Given("an intermediate CA signed by it with path length {int}")
  anIntermediateCaSignedByIt(pathLengthConstraint: number): void {
    this.ctx.ca = KryptosKit.generate.auto({
      algorithm: "ES256",
      certificate: {
        mode: "intermediate-ca",
        ca: this.ctx.ca,
        subject: "Intermediate",
        pathLengthConstraint,
      },
    });
  }

  @Given('a generated "{algorithm}" key as the CA')
  aGeneratedKeyAsTheCa(algorithm: KryptosAlgorithm): void {
    this.ctx.ca = KryptosKit.generate.auto({ algorithm });
  }

  @Given('a self-signed "{algorithm}" leaf as the CA')
  aSelfSignedLeafAsTheCa(algorithm: KryptosAlgorithm): void {
    this.ctx.ca = KryptosKit.generate.auto({
      algorithm,
      notBefore: CA_NOT_BEFORE,
      expiresAt: CA_EXPIRES_AT,
      certificate: { mode: "self-signed", subject: "leaf" },
    });
  }

  @When(
    'I generate an "{algorithm}" key with a self-signed certificate for subject {string}',
  )
  iGenerateAKeyWithASelfSignedCertificate(
    algorithm: KryptosAlgorithm,
    subject: string,
  ): void {
    this.ctx.kryptos = KryptosKit.generate.auto({
      algorithm,
      certificate: { mode: "self-signed", subject },
    });
  }

  @When(
    'I asynchronously generate an "{algorithm}" key with a self-signed certificate for subject {string}',
  )
  async iAsynchronouslyGenerateAKeyWithASelfSignedCertificate(
    algorithm: KryptosAlgorithm,
    subject: string,
  ): Promise<void> {
    this.ctx.kryptos = await KryptosKit.generateAsync.auto({
      algorithm,
      certificate: { mode: "self-signed", subject },
    });
  }

  @When('I generate an "{algorithm}" key signed by the CA with subject {string}')
  iGenerateAKeySignedByTheCa(algorithm: KryptosAlgorithm, subject: string): void {
    this.ctx.kryptos = KryptosKit.generate.auto({
      algorithm,
      certificate: { mode: "ca-signed", ca: this.ctx.ca, subject },
    });
  }

  @Then("the key has a certificate")
  theKeyHasACertificate(): void {
    expect(this.ctx.kryptos.hasCertificate).toBe(true);
  }

  @Then("the certificate thumbprint is present")
  theCertificateThumbprintIsPresent(): void {
    expect(this.ctx.kryptos.certificateThumbprint).toMatch(X5T_S256);
  }

  @Then("the certificate's subject and issuer are both {string}")
  theCertificatesSubjectAndIssuerAreBoth(name: string): void {
    const parsed = this.ctx.kryptos.parseCertificate();

    expect(parsed?.subject.commonName).toBe(name);
    expect(parsed?.issuer.commonName).toBe(name);
  }

  @Then("the certificate is not a CA")
  theCertificateIsNotACa(): void {
    expect(this.ctx.kryptos.parseCertificate()?.extensions.basicConstraintsCa).toBe(
      false,
    );
  }

  @Then("the CA's certificate is a CA with path length {int}")
  theCasCertificateIsACaWithPathLength(pathLength: number): void {
    const parsed = this.ctx.ca.parseCertificate();

    expect(parsed?.extensions.basicConstraintsCa).toBe(true);
    expect(parsed?.extensions.basicConstraintsPathLen).toBe(pathLength);
  }

  @Then("the certificate chain has {int} certificate(s)")
  theCertificateChainHasCertificates(length: number): void {
    expect(this.ctx.kryptos.certificate("b64")?.chain).toHaveLength(length);
  }

  @Then("the certificate verifies against the CA")
  theCertificateVerifiesAgainstTheCa(): void {
    this.ctx.kryptos.verifyCertificate({ trustAnchors: this.anchor(this.ctx.ca) });
  }

  @Then("the certificate verifies against the root")
  theCertificateVerifiesAgainstTheRoot(): void {
    this.ctx.kryptos.verifyCertificate({ trustAnchors: this.anchor(this.ctx.root) });
  }

  @Then(
    'generating an "{algorithm}" key with a self-signed certificate is refused as {string}',
  )
  generatingAKeyWithASelfSignedCertificateIsRefused(
    algorithm: KryptosAlgorithm,
    code: string,
  ): void {
    this.refused(code, () =>
      KryptosKit.generate.auto({ algorithm, certificate: { mode: "self-signed" } }),
    );
  }

  @Then('generating an "{algorithm}" key signed by the CA is refused as {string}')
  generatingAKeySignedByTheCaIsRefused(algorithm: KryptosAlgorithm, code: string): void {
    this.refused(code, () =>
      KryptosKit.generate.auto({
        algorithm,
        certificate: { mode: "ca-signed", ca: this.ctx.ca, subject: "leaf" },
      }),
    );
  }

  @Then(
    'generating an "{algorithm}" key signed by the CA expiring {string} is refused as {string}',
  )
  generatingAKeySignedByTheCaExpiringIsRefused(
    algorithm: KryptosAlgorithm,
    expiresAt: string,
    code: string,
  ): void {
    this.refused(code, () =>
      KryptosKit.generate.auto({
        algorithm,
        expiresAt: new Date(expiresAt),
        certificate: { mode: "ca-signed", ca: this.ctx.ca, subject: "leaf" },
      }),
    );
  }

  @Then("generating an intermediate CA signed by the CA is refused as {string}")
  generatingAnIntermediateCaSignedByTheCaIsRefused(code: string): void {
    this.refused(code, () =>
      KryptosKit.generate.auto({
        algorithm: "ES256",
        certificate: {
          mode: "intermediate-ca",
          ca: this.ctx.ca,
          subject: "Intermediate",
        },
      }),
    );
  }

  @Then(
    'generating an "{algorithm}" key signed by the CA in the {string} environment is refused as {string}',
  )
  generatingAKeySignedByTheCaInTheEnvironmentIsRefused(
    algorithm: KryptosAlgorithm,
    environment: string,
    code: string,
  ): void {
    this.refused(code, () =>
      KryptosKit.generate.auto({
        algorithm,
        certificate: {
          mode: "ca-signed",
          ca: this.ctx.ca,
          subject: "leaf",
          environment: this.environment(environment),
        },
      }),
    );
  }

  // brand

  @Then("the key is recognised as a Kryptos key")
  theKeyIsRecognisedAsAKryptosKey(): void {
    expect(KryptosKit.isKryptos(this.ctx.kryptos)).toBe(true);
  }

  @Then("an unbranded object shaped like a key is not recognised as a Kryptos key")
  anUnbrandedObjectShapedLikeAKeyIsNotRecognised(): void {
    this.candidate = { type: "oct", curve: null };

    expect(KryptosKit.isKryptos(this.candidate)).toBe(false);
  }

  @Then("{nonKey} is not recognised as a Kryptos key")
  isNotRecognisedAsAKryptosKey(value: NonKey): void {
    expect(KryptosKit.isKryptos(value)).toBe(false);
  }

  @Then("a key branded by a foreign copy of the library is recognised as a Kryptos key")
  aKeyBrandedByAForeignCopyIsRecognised(): void {
    this.candidate = {
      type: "oct",
      curve: null,
      constructor: { [Symbol.for("urn:lindorm:kryptos:brand:kryptos")]: true },
    };

    expect(KryptosKit.isKryptos(this.candidate)).toBe(true);
  }

  @Then("it does not narrow as an oct key")
  itDoesNotNarrowAsAnOctKey(): void {
    // `as never` carries the candidate past the KryptosLike parameter to the runtime guard.
    expect(KryptosKit.isOct(this.candidate as never)).toBe(false);
  }

  @Then("it narrows as an oct key and not as an EC key")
  itNarrowsAsAnOctKeyAndNotAsAnEcKey(): void {
    expect({
      isOct: KryptosKit.isOct(this.candidate as never),
      isEc: KryptosKit.isEc(this.candidate as never),
    }).toEqual({ isOct: true, isEc: false });
  }

  @Then(
    "the guards answer akp {boolean}, ec {boolean}, oct {boolean}, okp {boolean} and rsa {boolean}",
  )
  theGuardsAnswer(
    akp: boolean,
    ec: boolean,
    oct: boolean,
    okp: boolean,
    rsa: boolean,
  ): void {
    expect({
      akp: KryptosKit.isAkp(this.ctx.kryptos),
      ec: KryptosKit.isEc(this.ctx.kryptos),
      oct: KryptosKit.isOct(this.ctx.kryptos),
      okp: KryptosKit.isOkp(this.ctx.kryptos),
      rsa: KryptosKit.isRsa(this.ctx.kryptos),
    }).toEqual({ akp, ec, oct, okp, rsa });
  }

  // key assertions

  @Then("the key has type {string} and use {string}")
  theKeyHasTypeAndUse(type: string, use: string): void {
    expect({ type: this.ctx.kryptos.type, use: this.ctx.kryptos.use }).toEqual({
      type,
      use,
    });
  }

  @Then("the key has type {string}")
  theKeyHasType(type: string): void {
    expect(this.ctx.kryptos.type).toBe(type);
  }

  @Then('the key\'s algorithm is "{algorithm}"')
  theKeysAlgorithmIs(algorithm: KryptosAlgorithm): void {
    expect(this.ctx.kryptos.algorithm).toBe(algorithm);
  }

  @Then("the key's curve is {json}")
  theKeysCurveIs(curve: unknown): void {
    expect(this.ctx.kryptos.curve).toBe(this.curve(curve));
  }

  @Then("the key's encryption is {json}")
  theKeysEncryptionIs(encryption: unknown): void {
    expect(this.ctx.kryptos.encryption).toBe(this.encryption(encryption));
  }

  @Then("the key carries both a private and a public half")
  theKeyCarriesBothHalves(): void {
    expect({
      hasPrivateKey: this.ctx.kryptos.hasPrivateKey,
      hasPublicKey: this.ctx.kryptos.hasPublicKey,
    }).toEqual({ hasPrivateKey: true, hasPublicKey: true });
  }

  @Then("the key carries only a private half")
  theKeyCarriesOnlyAPrivateHalf(): void {
    expect({
      hasPrivateKey: this.ctx.kryptos.hasPrivateKey,
      hasPublicKey: this.ctx.kryptos.hasPublicKey,
    }).toEqual({ hasPrivateKey: true, hasPublicKey: false });
  }

  @Then('the key type resolved for "{algorithm}" is {string}')
  theKeyTypeResolvedForIs(algorithm: KryptosAlgorithm, type: string): void {
    expect(KryptosKit.getTypeForAlgorithm(algorithm)).toBe(type);
  }

  @Then("the key carries those options")
  theKeyCarriesThoseOptions(): void {
    const carried = Object.fromEntries(
      Object.keys(this.options).map((name) => [
        name,
        this.ctx.kryptos[name as keyof GenerateOptions],
      ]),
    );

    expect(carried).toEqual(this.options);
  }

  @Then("the {subject} expires at {string}")
  theSubjectExpiresAt(subject: Subject, expiresAt: string): void {
    expect(this.ctx[subject].expiresAt.toISOString()).toBe(expiresAt);
  }

  @Then("the {subject} is internal")
  theSubjectIsInternal(subject: Subject): void {
    expect(this.ctx[subject].internal).toBe(true);
  }

  @Then("the {subject} is not internal")
  theSubjectIsNotInternal(subject: Subject): void {
    expect(this.ctx[subject].internal).toBe(false);
  }

  @Then("the {subject} is published")
  theSubjectIsPublished(subject: Subject): void {
    expect(this.ctx[subject].publish).toBe(true);
  }

  @Then("the {subject} is unpublished")
  theSubjectIsUnpublished(subject: Subject): void {
    expect(this.ctx[subject].publish).toBe(false);
  }

  @Then("the {subject}'s id is {string}")
  theSubjectsIdIs(subject: Subject, id: string): void {
    expect(this.ctx[subject].id).toBe(id);
  }

  @Then("the {subject}'s id is a 16-character key id")
  theSubjectsIdIsAKeyId(subject: Subject): void {
    expect(this.ctx[subject].id).toMatch(KEY_ID);
  }

  @Then("the {subject}'s purpose is {json}")
  theSubjectsPurposeIs(subject: Subject, purpose: unknown): void {
    expect(this.ctx[subject].purpose).toBe(purpose);
  }

  @Then("the {subject} has the same id as the key")
  theSubjectHasTheSameIdAsTheKey(subject: Subject): void {
    expect(this.ctx[subject].id).toBe(this.ctx.kryptos.id);
  }

  @Then("the {subject} matches the key's database row")
  theSubjectMatchesTheKeysDatabaseRow(subject: Subject): void {
    expect(this.ctx[subject].toDB()).toEqual(this.ctx.kryptos.toDB());
  }

  @Then("both keys have the same id")
  bothKeysHaveTheSameId(): void {
    expect(this.ctx.other.id).toBe(this.ctx.kryptos.id);
  }

  @Then("both keys have different ids")
  bothKeysHaveDifferentIds(): void {
    expect(this.ctx.other.id).not.toBe(this.ctx.kryptos.id);
  }

  @Then("both keys export the same private JWK")
  bothKeysExportTheSamePrivateJwk(): void {
    expect(this.ctx.other.export("jwk")).toEqual(this.ctx.kryptos.export("jwk"));
  }

  @Then("both keys have identical private material")
  bothKeysHaveIdenticalPrivateMaterial(): void {
    expect(this.ctx.other.export("der").privateKey).toEqual(
      this.ctx.kryptos.export("der").privateKey,
    );
  }

  @Then("both keys have different private material")
  bothKeysHaveDifferentPrivateMaterial(): void {
    expect(this.ctx.other.export("der").privateKey).not.toEqual(
      this.ctx.kryptos.export("der").privateKey,
    );
  }

  // helpers

  private rootCa(options: {
    environment?: Environment;
    pathLengthConstraint?: number;
  }): void {
    this.ctx.ca = KryptosKit.generate.auto({
      algorithm: "ES384",
      notBefore: CA_NOT_BEFORE,
      expiresAt: CA_EXPIRES_AT,
      certificate: { mode: "root-ca", subject: "Root", ...options },
    });
    this.ctx.root = this.ctx.ca;
  }

  private anchor(ca: IKryptos): string {
    const certificate = ca.certificate("b64");

    if (certificate) {
      return certificate.chain[0];
    }

    throw new Error("the trust anchor carries no certificate");
  }

  private environment(raw: string): Environment {
    return pick(
      ["development", "production", "staging", "test", "unknown"] as const,
      raw,
      "environment",
    );
  }

  private curve(raw: unknown): KryptosCurve | null {
    if (raw === null) {
      return null;
    }

    return pick(
      [...EC_CURVES, ...OKP_SIG_CURVES, ...OKP_ENC_CURVES],
      String(raw),
      "curve",
    );
  }

  private encryption(raw: unknown): KryptosEncryption | null {
    if (raw === null) {
      return null;
    }

    return pick(AES_ENCRYPTION_ALGORITHMS, String(raw), "content encryption");
  }

  private tamperedCborEnv(label: number, value: unknown): string {
    const env = KryptosKit.generate.auto({ algorithm: "ES256" }).toEnvString("cbor");
    const bytes = B64.toBuffer(env.slice("kryptos:".length), "b64u");
    const map = decode<Map<number, unknown>>(bytes, { preferMap: true });

    map.set(label, value);

    return "kryptos:" + B64.encode(encode(map, { cde: true }), "b64u");
  }

  private generateSig(type: KryptosType, algorithm: KryptosSigAlgorithm): IKryptos {
    switch (type) {
      case "AKP":
        return KryptosKit.generate.sig.akp({
          algorithm: pick(AKP_SIG_ALGORITHMS, algorithm, "AKP signing algorithm"),
        });

      case "EC":
        return KryptosKit.generate.sig.ec({
          algorithm: pick(EC_SIG_ALGORITHMS, algorithm, "EC signing algorithm"),
        });

      case "oct":
        return KryptosKit.generate.sig.oct({
          algorithm: pick(OCT_SIG_ALGORITHMS, algorithm, "oct signing algorithm"),
        });

      case "OKP":
        return KryptosKit.generate.sig.okp({
          algorithm: pick(OKP_SIG_ALGORITHMS, algorithm, "OKP signing algorithm"),
        });

      case "RSA":
        return KryptosKit.generate.sig.rsa({
          algorithm: pick(RSA_SIG_ALGORITHMS, algorithm, "RSA signing algorithm"),
        });

      default: {
        const exhaustive: never = type;
        throw new Error(`unhandled key type "${String(exhaustive)}"`);
      }
    }
  }

  private async generateSigAsync(
    type: KryptosType,
    algorithm: KryptosSigAlgorithm,
  ): Promise<IKryptos> {
    switch (type) {
      case "AKP":
        return KryptosKit.generateAsync.sig.akp({
          algorithm: pick(AKP_SIG_ALGORITHMS, algorithm, "AKP signing algorithm"),
        });

      case "EC":
        return KryptosKit.generateAsync.sig.ec({
          algorithm: pick(EC_SIG_ALGORITHMS, algorithm, "EC signing algorithm"),
        });

      case "oct":
        return KryptosKit.generateAsync.sig.oct({
          algorithm: pick(OCT_SIG_ALGORITHMS, algorithm, "oct signing algorithm"),
        });

      case "OKP":
        return KryptosKit.generateAsync.sig.okp({
          algorithm: pick(OKP_SIG_ALGORITHMS, algorithm, "OKP signing algorithm"),
        });

      case "RSA":
        return KryptosKit.generateAsync.sig.rsa({
          algorithm: pick(RSA_SIG_ALGORITHMS, algorithm, "RSA signing algorithm"),
        });

      default: {
        const exhaustive: never = type;
        throw new Error(`unhandled key type "${String(exhaustive)}"`);
      }
    }
  }

  private generateEnc(type: KryptosType, algorithm: KryptosEncAlgorithm): IKryptos {
    switch (type) {
      case "EC":
        return KryptosKit.generate.enc.ec({
          algorithm: pick(EC_ENC_ALGORITHMS, algorithm, "EC encryption algorithm"),
        });

      case "oct":
        return KryptosKit.generate.enc.oct({
          algorithm: pick(
            [...OCT_ENC_DIR_ALGORITHMS, ...OCT_ENC_STD_ALGORITHMS],
            algorithm,
            "oct encryption algorithm",
          ),
        });

      case "OKP":
        return KryptosKit.generate.enc.okp({
          algorithm: pick(OKP_ENC_ALGORITHMS, algorithm, "OKP encryption algorithm"),
        });

      case "RSA":
        return KryptosKit.generate.enc.rsa({
          algorithm: pick(RSA_ENC_ALGORITHMS, algorithm, "RSA encryption algorithm"),
        });

      case "AKP":
        throw new Error("AKP keys do not encrypt");

      default: {
        const exhaustive: never = type;
        throw new Error(`unhandled key type "${String(exhaustive)}"`);
      }
    }
  }

  private async generateEncAsync(
    type: KryptosType,
    algorithm: KryptosEncAlgorithm,
  ): Promise<IKryptos> {
    switch (type) {
      case "EC":
        return KryptosKit.generateAsync.enc.ec({
          algorithm: pick(EC_ENC_ALGORITHMS, algorithm, "EC encryption algorithm"),
        });

      case "oct":
        return KryptosKit.generateAsync.enc.oct({
          algorithm: pick(
            [...OCT_ENC_DIR_ALGORITHMS, ...OCT_ENC_STD_ALGORITHMS],
            algorithm,
            "oct encryption algorithm",
          ),
        });

      case "OKP":
        return KryptosKit.generateAsync.enc.okp({
          algorithm: pick(OKP_ENC_ALGORITHMS, algorithm, "OKP encryption algorithm"),
        });

      case "RSA":
        return KryptosKit.generateAsync.enc.rsa({
          algorithm: pick(RSA_ENC_ALGORITHMS, algorithm, "RSA encryption algorithm"),
        });

      case "AKP":
        throw new Error("AKP keys do not encrypt");

      default: {
        const exhaustive: never = type;
        throw new Error(`unhandled key type "${String(exhaustive)}"`);
      }
    }
  }

  // parameter types

  @ParameterType("algorithm", /[A-Za-z0-9+-]+/)
  static algorithm(raw: string): KryptosAlgorithm {
    return pick(KRYPTOS_ALGORITHMS, raw, "algorithm");
  }

  @ParameterType("sigAlgorithm", /[A-Za-z0-9+-]+/)
  static sigAlgorithm(raw: string): KryptosSigAlgorithm {
    return pick(KRYPTOS_SIG_ALGORITHMS, raw, "signing algorithm");
  }

  @ParameterType("encAlgorithm", /[A-Za-z0-9+-]+/)
  static encAlgorithm(raw: string): KryptosEncAlgorithm {
    return pick(KRYPTOS_ENC_ALGORITHMS, raw, "encryption algorithm");
  }

  @ParameterType("curve", /[A-Za-z0-9-]+/)
  static curve(raw: string): KryptosCurve {
    return pick([...EC_CURVES, ...OKP_SIG_CURVES, ...OKP_ENC_CURVES], raw, "curve");
  }

  // KryptosType, KryptosUse and KryptosEnvFormat are bare unions
  // with no shipped const array, so the regexp is the closed list and the
  // switch narrows it.
  @ParameterType("keyType", /AKP|EC|oct|OKP|RSA/)
  static keyType(raw: string): KryptosType {
    switch (raw) {
      case "AKP":
      case "EC":
      case "oct":
      case "OKP":
      case "RSA":
        return raw;

      default:
        throw new Error(`unknown key type "${raw}"`);
    }
  }

  @ParameterType("use", /sig|enc/)
  static use(raw: string): KryptosUse {
    switch (raw) {
      case "sig":
      case "enc":
        return raw;

      default:
        throw new Error(`unknown key use "${raw}"`);
    }
  }

  @ParameterType("format", /b64|der|jwk|pem/)
  static format(raw: string): KeyFormat {
    switch (raw) {
      case "b64":
      case "der":
      case "jwk":
      case "pem":
        return raw;

      default:
        throw new Error(`unknown key format "${raw}"`);
    }
  }

  @ParameterType("envFormat", /cbor|json/)
  static envFormat(raw: string): KryptosEnvFormat {
    switch (raw) {
      case "cbor":
      case "json":
        return raw;

      default:
        throw new Error(`unknown env format "${raw}"`);
    }
  }

  @ParameterType("member", /algorithm|type|use/)
  static member(raw: string): "algorithm" | "type" | "use" {
    switch (raw) {
      case "algorithm":
      case "type":
      case "use":
        return raw;

      default:
        throw new Error(`unknown key member "${raw}"`);
    }
  }

  @ParameterType("payload", /a CBOR map|a JSON object/)
  static payload(raw: string): (first: number) => boolean {
    return raw === "a CBOR map"
      ? (first): boolean =>
          first >= CBOR_MAP_HEADER_RANGE.min && first <= CBOR_MAP_HEADER_RANGE.max
      : (first): boolean => first === JSON_OBJECT_OPENING_BRACE;
  }

  @ParameterType("published", /published|unpublished/)
  static published(raw: string): boolean {
    return raw === "published";
  }

  @ParameterType("subject", /imported key|restored key|derived key|clone|key/)
  static subject(raw: string): Subject {
    return raw === "key" ? "kryptos" : "other";
  }

  @ParameterType("nonKey", /null|undefined|a string|a number/)
  static nonKey(raw: string): NonKey {
    switch (raw) {
      case "null":
        return null;

      case "undefined":
        return undefined;

      case "a string":
        return "kryptos";

      case "a number":
        return 42;

      default:
        throw new Error(`unknown non-key value "${raw}"`);
    }
  }

  @ParameterType("boolean", /true|false/)
  static boolean(raw: string): boolean {
    return raw === "true";
  }

  @ParameterType("json", /\S+/)
  static json(raw: string): unknown {
    return JSON.parse(raw);
  }
}
