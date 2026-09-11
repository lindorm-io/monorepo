import {
  AfterScenario,
  Binding,
  DataTable,
  Given,
  ParameterType,
  Then,
  When,
} from "@lindorm/gherkin";
import { isArray, isString } from "@lindorm/is";
import { createHash } from "crypto";
import { expect, vi } from "vitest";
import { Kryptos, KryptosKit } from "../classes/index.js";
import type {
  KryptosEnvFormat,
  KryptosExportMode,
  KryptosJwk,
  LindormJwk,
} from "../types/index.js";
import type { KeyFormat, Subject } from "./kryptos-steps-base.js";
import { KryptosStepsBase } from "./kryptos-steps-base.js";
import {
  TEST_X509_ALT_ROOT_PEM,
  TEST_X509_LEAF_PEM,
  TEST_X509_ROOT_PEM,
} from "./x509.js";

type LifetimeState = "pending" | "active" | "expired";

type JwkMode = KryptosExportMode | "default";

type Anchor = "fixture root" | "alternative fixture root";

const PRIVATE_MEMBERS = ["d", "p", "q", "dp", "dq", "qi", "k"] as const;

const MATERIAL_MEMBERS = ["privateKey", "publicKey", "d", "k", "priv"] as const;

const LIFETIME: Record<
  LifetimeState,
  { isPending: boolean; isActive: boolean; isExpired: boolean }
> = {
  pending: { isPending: true, isActive: false, isExpired: false },
  active: { isPending: false, isActive: true, isExpired: false },
  expired: { isPending: false, isActive: false, isExpired: true },
};

const ANCHORS: Record<Anchor, string> = {
  "fixture root": TEST_X509_ROOT_PEM,
  "alternative fixture root": TEST_X509_ALT_ROOT_PEM,
};

const stringList = (raw: unknown, what: string): Array<string> => {
  if (isArray<unknown>(raw) && raw.every((item) => isString(item))) {
    return raw;
  }

  throw new Error(`${what} must be a JSON array of strings`);
};

const digest = (algorithm: "sha1" | "sha256", data: Buffer | string): string =>
  createHash(algorithm).update(data).digest("base64url");

@Binding()
export class KryptosSteps extends KryptosStepsBase {
  @AfterScenario()
  restoreClock(): void {
    vi.useRealTimers();
  }

  // metadata

  @Then("the key's algorithm class is {string}")
  theKeysAlgorithmClassIs(algClass: string): void {
    expect(this.ctx.kryptos.algClass).toBe(algClass);
  }

  @Then("the key's modulus is {json}")
  theKeysModulusIs(modulus: unknown): void {
    expect(this.ctx.kryptos.modulus).toBe(modulus);
  }

  @Then("the key prints as {string} followed by its id")
  theKeyPrintsAs(prefix: string): void {
    expect(this.ctx.kryptos.toString()).toBe(`${prefix}${this.ctx.kryptos.id}>`);
  }

  @Then("the key was created at {string}")
  theKeyWasCreatedAt(createdAt: string): void {
    expect(this.ctx.kryptos.createdAt.toISOString()).toBe(createdAt);
  }

  @Then("the key is valid from {string}")
  theKeyIsValidFrom(notBefore: string): void {
    expect(this.ctx.kryptos.notBefore.toISOString()).toBe(notBefore);
  }

  @Then("the key's issuer, jwksUri, ownerId and purpose are all null")
  theKeysDescriptorsAreAllNull(): void {
    expect({
      issuer: this.ctx.kryptos.issuer,
      jwksUri: this.ctx.kryptos.jwksUri,
      ownerId: this.ctx.kryptos.ownerId,
      purpose: this.ctx.kryptos.purpose,
    }).toEqual({ issuer: null, jwksUri: null, ownerId: null, purpose: null });
  }

  @Then("the {subject}'s operations are {json}")
  theSubjectsOperationsAre(subject: Subject, operations: unknown): void {
    expect(this.ctx[subject].operations).toEqual(operations);
  }

  // lifetime

  @Given("the clock reads {string}")
  theClockReads(now: string): void {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
  }

  @Then("the key is {lifetime}")
  theKeyIs(state: LifetimeState): void {
    expect({
      isPending: this.ctx.kryptos.isPending,
      isActive: this.ctx.kryptos.isActive,
      isExpired: this.ctx.kryptos.isExpired,
    }).toEqual(LIFETIME[state]);
  }

  @Then("the key expires in {int} seconds")
  theKeyExpiresInSeconds(seconds: number): void {
    expect(this.ctx.kryptos.expiresIn).toBe(seconds);
  }

  // export

  @When("I re-import the key from its {format} export")
  iReImportTheKeyFromItsExport(format: KeyFormat): void {
    switch (format) {
      case "b64":
        this.ctx.other = KryptosKit.from.b64(this.ctx.kryptos.export("b64"));
        break;

      case "der":
        this.ctx.other = KryptosKit.from.der(this.ctx.kryptos.export("der"));
        break;

      case "jwk":
        this.ctx.other = KryptosKit.from.jwk(this.ctx.kryptos.export("jwk"));
        break;

      case "pem":
        this.ctx.other = KryptosKit.from.pem(this.ctx.kryptos.export("pem"));
        break;

      default: {
        const exhaustive: never = format;
        throw new Error(`unhandled export format "${String(exhaustive)}"`);
      }
    }
  }

  @Then("the {subject} matches the key's id, thumbprint and material")
  theSubjectMatchesTheKeysIdThumbprintAndMaterial(subject: Subject): void {
    expect({
      id: this.ctx[subject].id,
      thumbprint: this.ctx[subject].thumbprint,
      material: this.ctx[subject].export("der"),
    }).toEqual({
      id: this.ctx.kryptos.id,
      thumbprint: this.ctx.kryptos.thumbprint,
      material: this.ctx.kryptos.export("der"),
    });
  }

  @Then("the PEM export carries the leaf certificate and the whole chain")
  thePemExportCarriesTheLeafCertificateAndTheWholeChain(): void {
    const chain = this.ctx.kryptos.certificate("pem")?.chain;
    const pem = this.ctx.kryptos.export("pem");

    expect(chain).toHaveLength(2);
    expect(pem.certificate).toBe(chain?.[0]);
    expect(pem.certificateChain).toEqual(chain);
  }

  @Then("the PEM export carries no certificate")
  thePemExportCarriesNoCertificate(): void {
    const pem = this.ctx.kryptos.export("pem");

    expect(Object.hasOwn(pem, "certificate")).toBe(false);
    expect(Object.hasOwn(pem, "certificateChain")).toBe(false);
  }

  @Then("exporting the key as {string} is refused as {string}")
  exportingTheKeyAsIsRefused(format: string, code: string): void {
    // The cast smuggles the raw word past the overloads so it reaches the
    // runtime format switch (Kryptos.export default branch).
    this.refused(code, () => this.ctx.kryptos.export(format as "b64"));
  }

  // jwk

  @Then("the key's public JWK carries the members {json}")
  theKeysPublicJwkCarriesTheMembers(members: unknown): void {
    const jwk = this.ctx.kryptos.toJWK("public");

    for (const member of stringList(members, "members")) {
      expect(isString(this.member(jwk, member))).toBe(true);
    }
  }

  @Then("the key's public JWK carries none of the members {json}")
  theKeysPublicJwkCarriesNoneOfTheMembers(members: unknown): void {
    const jwk = this.ctx.kryptos.toJWK("public");

    for (const member of stringList(members, "members")) {
      expect(Object.hasOwn(jwk, member)).toBe(false);
    }
  }

  @Then("the key's public JWK carries no private member and no publish flag")
  theKeysPublicJwkCarriesNoPrivateMemberAndNoPublishFlag(): void {
    const jwk = this.ctx.kryptos.toJWK("public");

    for (const member of [...PRIVATE_MEMBERS, "publish"]) {
      expect(Object.hasOwn(jwk, member)).toBe(false);
    }
  }

  @Then("the key's private JWK carries the members {json} and the publish flag")
  theKeysPrivateJwkCarriesTheMembersAndThePublishFlag(members: unknown): void {
    const jwk = this.ctx.kryptos.toJWK("private");

    for (const member of stringList(members, "members")) {
      expect(isString(this.member(jwk, member))).toBe(true);
    }

    expect(jwk.publish).toBe(this.ctx.kryptos.publish);
  }

  @Then("asking the key for its {jwkMode} JWK is refused as {string}")
  askingTheKeyForItsJwkIsRefused(mode: JwkMode, code: string): void {
    this.refused(code, () =>
      mode === "default" ? this.ctx.kryptos.toJWK() : this.ctx.kryptos.toJWK(mode),
    );
  }

  @Then("the key's {jwkMode} JWK carries no key_ops")
  theKeysJwkCarriesNoKeyOps(mode: JwkMode): void {
    const jwk =
      mode === "default" ? this.ctx.kryptos.toJWK() : this.ctx.kryptos.toJWK(mode);

    expect(Object.hasOwn(jwk, "key_ops")).toBe(false);
  }

  @Then("both JWK modes carry the key's id as kid")
  bothJwkModesCarryTheKeysIdAsKid(): void {
    expect({
      publicKid: this.ctx.kryptos.toJWK("public").kid,
      privateKid: this.ctx.kryptos.toJWK("private").kid,
    }).toEqual({ publicKid: this.ctx.kryptos.id, privateKid: this.ctx.kryptos.id });
  }

  @Then("the key's public JWK carries the {int}-certificate chain and its digests")
  theKeysPublicJwkCarriesTheChainAndItsDigests(length: number): void {
    const jwk = this.ctx.kryptos.toJWK("public");
    const certificate = this.ctx.kryptos.certificate("b64");

    expect(certificate?.chain).toHaveLength(length);
    expect(jwk.x5c).toEqual(certificate?.chain);
    expect(jwk["x5t#S256"]).toBe(certificate?.thumbprint);
    expect(jwk.x5t).toBe(certificate?.thumbprintSha1);
  }

  // storage and logs

  @Then(
    "the database row carries the key's base64 material, certificate chain and attributes",
  )
  theDatabaseRowCarriesTheKeysMaterialChainAndAttributes(): void {
    const key = this.ctx.kryptos;
    const material = key.export("b64");
    const chain = key.certificate("b64")?.chain;

    expect(chain).toHaveLength(2);
    expect(key.toDB()).toEqual({
      id: key.id,
      algorithm: key.algorithm,
      certificateChain: chain,
      createdAt: key.createdAt,
      curve: key.curve,
      encryption: key.encryption,
      expiresAt: key.expiresAt,
      internal: key.internal,
      issuer: key.issuer,
      jwksUri: key.jwksUri,
      notBefore: key.notBefore,
      ownerId: key.ownerId,
      publish: key.publish,
      purpose: key.purpose,
      type: key.type,
      use: key.use,
      privateKey: material.privateKey,
      publicKey: material.publicKey,
    });
  }

  @Then("the {subject} carries the same certificate chain as the key")
  theSubjectCarriesTheSameCertificateChainAsTheKey(subject: Subject): void {
    expect(this.ctx.kryptos.certificate("b64")?.chain).toHaveLength(2);
    expect(this.ctx[subject].certificate("b64")).toEqual(
      this.ctx.kryptos.certificate("b64"),
    );
  }

  @Then("the JSON view carries no key material")
  theJsonViewCarriesNoKeyMaterial(): void {
    const json = this.ctx.kryptos.toJSON();
    const serialised = JSON.stringify(json);
    const material = this.ctx.kryptos.export("b64");
    const jwk = this.ctx.kryptos.export("jwk");

    for (const member of MATERIAL_MEMBERS) {
      expect(Object.hasOwn(json, member)).toBe(false);
    }

    for (const secret of [material.privateKey, jwk.d, jwk.k, jwk.priv]) {
      if (isString(secret)) {
        expect(serialised).not.toContain(secret);
      }
    }
  }

  @Then("the JSON view reports")
  theJsonViewReports(table: DataTable): void {
    const json = this.ctx.kryptos.toJSON();
    const expected = Object.fromEntries(
      Object.entries(table.rowsHash()).map(([name, value]) => [name, JSON.parse(value)]),
    );
    const reported = Object.fromEntries(
      Object.keys(expected).map((name) => [name, json[name as keyof typeof json]]),
    );

    expect(reported).toEqual(expected);
  }

  @Then("the JSON view's thumbprint and certificate thumbprint are the key's")
  theJsonViewsThumbprintsAreTheKeys(): void {
    const json = this.ctx.kryptos.toJSON();

    expect(this.ctx.kryptos.certificateThumbprint).not.toBeNull();
    expect({
      thumbprint: json.thumbprint,
      certificateThumbprint: json.certificateThumbprint,
    }).toEqual({
      thumbprint: this.ctx.kryptos.thumbprint,
      certificateThumbprint: this.ctx.kryptos.certificateThumbprint,
    });
  }

  @When("I serialise the key as an env string")
  iSerialiseTheKeyAsAnEnvString(): void {
    this.ctx.serialised = this.ctx.kryptos.toEnvString();
  }

  @When('I serialise the key as a "{envFormat}" env string')
  iSerialiseTheKeyAsAFormatEnvString(format: KryptosEnvFormat): void {
    this.ctx.serialised = this.ctx.kryptos.toEnvString(format);
  }

  @Then("serialising the key as an env string is refused as {string}")
  serialisingTheKeyAsAnEnvStringIsRefused(code: string): void {
    this.refused(code, () => this.ctx.kryptos.toEnvString());
  }

  @Then("serialising the key in the {string} env format is refused as {string}")
  serialisingTheKeyAsAFormatEnvStringIsRefused(format: string, code: string): void {
    this.refused(code, () => this.ctx.kryptos.toEnvString(format as KryptosEnvFormat));
  }

  // thumbprint

  @Then("the {subject} has the same thumbprint as the key")
  theSubjectHasTheSameThumbprintAsTheKey(subject: Subject): void {
    expect(this.ctx[subject].thumbprint).toBe(this.ctx.kryptos.thumbprint);
  }

  @Then("both keys have different thumbprints")
  bothKeysHaveDifferentThumbprints(): void {
    expect(this.ctx.other.thumbprint).not.toBe(this.ctx.kryptos.thumbprint);
  }

  @Then("the key's thumbprint is the base64url SHA-256 of its JWK members {json}")
  theKeysThumbprintIsTheDigestOfItsJwkMembers(members: unknown): void {
    const jwk = this.ctx.kryptos.export("jwk");
    const canonical = Object.fromEntries(
      stringList(members, "members").map((member) => [member, this.member(jwk, member)]),
    );

    expect(this.ctx.kryptos.thumbprint).toBe(digest("sha256", JSON.stringify(canonical)));
  }

  // dispose

  @When("I dispose of the key")
  iDisposeOfTheKey(): void {
    this.ctx.kryptos.dispose();
  }

  @When("the key leaves a using block")
  theKeyLeavesAUsingBlock(): void {
    {
      using key = this.ctx.kryptos;

      expect(key.thumbprint).toEqual(expect.any(String));
    }
  }

  @Then("the key reports no private key and no public key")
  theKeyReportsNoPrivateKeyAndNoPublicKey(): void {
    expect({
      hasPrivateKey: this.ctx.kryptos.hasPrivateKey,
      hasPublicKey: this.ctx.kryptos.hasPublicKey,
    }).toEqual({ hasPrivateKey: false, hasPublicKey: false });
  }

  @Then("reading the key's thumbprint is refused as {string}")
  readingTheKeysThumbprintIsRefused(code: string): void {
    this.refused(code, () => this.ctx.kryptos.thumbprint);
  }

  @Then("asking the key for its database row is refused as {string}")
  askingTheKeyForItsDatabaseRowIsRefused(code: string): void {
    this.refused(code, () => this.ctx.kryptos.toDB());
  }

  // certificate

  @Then("the b64, der, jwk and pem certificate formats state the same chain and digests")
  everyCertificateFormatStatesTheSameChainAndDigests(): void {
    const b64 = this.ctx.kryptos.certificate("b64");
    const der = this.ctx.kryptos.certificate("der");
    const jwk = this.ctx.kryptos.certificate("jwk");
    const pem = this.ctx.kryptos.certificate("pem");

    expect(b64?.chain).toHaveLength(3);
    expect(der?.chain.map((entry) => entry.toString("base64"))).toEqual(b64?.chain);
    expect(jwk?.x5c).toEqual(b64?.chain);
    expect(pem?.chain.map((entry) => this.unwrapPem(entry))).toEqual(b64?.chain);

    expect({
      der: der?.thumbprint.toString("base64url"),
      jwk: jwk?.["x5t#S256"],
    }).toEqual({ der: b64?.thumbprint, jwk: b64?.thumbprint });

    expect({
      der: der?.thumbprintSha1.toString("base64url"),
      jwk: jwk?.x5t,
    }).toEqual({ der: b64?.thumbprintSha1, jwk: b64?.thumbprintSha1 });
  }

  @Then("the certificate digests are those of the leaf")
  theCertificateDigestsAreThoseOfTheLeaf(): void {
    const der = this.ctx.kryptos.certificate("der");

    expect(der?.chain).toHaveLength(3);
    expect({
      thumbprint: der?.thumbprint.toString("base64url"),
      thumbprintSha1: der?.thumbprintSha1.toString("base64url"),
    }).toEqual({
      thumbprint: digest("sha256", der?.chain[0] ?? ""),
      thumbprintSha1: digest("sha1", der?.chain[0] ?? ""),
    });
  }

  @Then("the certificate thumbprint on the key is the chain's SHA-256 digest")
  theCertificateThumbprintOnTheKeyIsTheChainsDigest(): void {
    expect(this.ctx.kryptos.certificateThumbprint).toBe(
      this.ctx.kryptos.certificate("b64")?.thumbprint,
    );
  }

  @Then("every certificate format states no certificate")
  everyCertificateFormatStatesNoCertificate(): void {
    expect({
      b64: this.ctx.kryptos.certificate("b64"),
      der: this.ctx.kryptos.certificate("der"),
      jwk: this.ctx.kryptos.certificate("jwk"),
      pem: this.ctx.kryptos.certificate("pem"),
      hasCertificate: this.ctx.kryptos.hasCertificate,
    }).toEqual({ b64: null, der: null, jwk: null, pem: null, hasCertificate: false });
  }

  @Then("the certificate thumbprint is absent")
  theCertificateThumbprintIsAbsent(): void {
    expect(this.ctx.kryptos.certificateThumbprint).toBeNull();
  }

  @Then("asking for the certificate in {string} format is refused as {string}")
  askingForTheCertificateInFormatIsRefused(format: string, code: string): void {
    this.refused(code, () => this.ctx.kryptos.certificate(format as "b64"));
  }

  @Then("the certificate at index {int} has subject {string}")
  theCertificateAtIndexHasSubject(index: number, subject: string): void {
    expect(this.ctx.kryptos.parseCertificate(index)?.subject.commonName).toBe(subject);
  }

  @Then("the parsed leaf is the certificate at index 0")
  theParsedLeafIsTheCertificateAtIndex0(): void {
    expect(this.ctx.kryptos.parseCertificate()).not.toBeNull();
    expect(this.ctx.kryptos.parseCertificate()).toBe(
      this.ctx.kryptos.parseCertificate(0),
    );
  }

  @Then("the certificate at index {float} is absent")
  theCertificateAtIndexIsAbsent(index: number): void {
    expect(this.ctx.kryptos.parseCertificate(index)).toBeNull();
  }

  @Then("the certificate verifies against the {anchor}")
  theCertificateVerifiesAgainstTheAnchor(anchor: Anchor): void {
    this.ctx.kryptos.verifyCertificate({ trustAnchors: ANCHORS[anchor] });
  }

  @Then("verifying the certificate against the {anchor} is refused as {string}")
  verifyingTheCertificateAgainstTheAnchorIsRefused(anchor: Anchor, code: string): void {
    this.refused(code, () =>
      this.ctx.kryptos.verifyCertificate({ trustAnchors: ANCHORS[anchor] }),
    );
  }

  @Then(
    "verifying the certificate against an empty trust anchor set is refused as {string}",
  )
  verifyingTheCertificateAgainstAnEmptyTrustAnchorSetIsRefused(code: string): void {
    this.refused(code, () => this.ctx.kryptos.verifyCertificate({ trustAnchors: [] }));
  }

  @Then(
    "importing its PEM export carrying the fixture leaf certificate is refused as {string}",
  )
  importingItsPemExportCarryingTheFixtureLeafCertificateIsRefused(code: string): void {
    this.refused(code, () =>
      KryptosKit.from.pem({
        ...this.ctx.kryptos.export("pem"),
        certificateChain: [TEST_X509_LEAF_PEM],
      }),
    );
  }

  @Then(
    "importing its public JWK carrying the fixture leaf certificate is refused as {string}",
  )
  importingItsPublicJwkCarryingTheFixtureLeafCertificateIsRefused(code: string): void {
    this.refused(code, () =>
      KryptosKit.from.jwk({
        ...this.ctx.kryptos.toJWK("public"),
        x5c: [this.unwrapPem(TEST_X509_LEAF_PEM)],
      }),
    );
  }

  // construction

  @Then("constructing an EC key without any key material is refused as {string}")
  constructingAnEcKeyWithoutAnyKeyMaterialIsRefused(code: string): void {
    this.refused(
      code,
      () => new Kryptos({ algorithm: "ES256", curve: "P-256", type: "EC", use: "sig" }),
    );
  }

  @Then("constructing a symmetric key with a certificate chain is refused as {string}")
  constructingASymmetricKeyWithACertificateChainIsRefused(code: string): void {
    this.refused(
      code,
      () =>
        new Kryptos({
          algorithm: "HS256",
          type: "oct",
          use: "sig",
          privateKey: Buffer.alloc(32, 1),
          certificateChain: [TEST_X509_LEAF_PEM],
        }),
    );
  }

  // helpers

  private member(jwk: KryptosJwk | LindormJwk, name: string): unknown {
    return Object.hasOwn(jwk, name) ? jwk[name as keyof typeof jwk] : undefined;
  }

  // parameter types

  @ParameterType("lifetime", /pending|active|expired/)
  static lifetime(raw: string): LifetimeState {
    switch (raw) {
      case "pending":
      case "active":
      case "expired":
        return raw;

      default:
        throw new Error(`unknown lifetime state "${raw}"`);
    }
  }

  @ParameterType("jwkMode", /public|private|default/)
  static jwkMode(raw: string): JwkMode {
    switch (raw) {
      case "public":
      case "private":
      case "default":
        return raw;

      default:
        throw new Error(`unknown JWK mode "${raw}"`);
    }
  }

  @ParameterType("anchor", /fixture root|alternative fixture root/)
  static anchor(raw: string): Anchor {
    switch (raw) {
      case "fixture root":
      case "alternative fixture root":
        return raw;

      default:
        throw new Error(`unknown trust anchor "${raw}"`);
    }
  }
}
