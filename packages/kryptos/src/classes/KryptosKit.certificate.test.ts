import * as x509 from "@peculiar/x509";
import { X509Certificate } from "crypto";
import MockDate from "mockdate";
import { KryptosError } from "../errors";
import { parseX509Certificate } from "#internal/utils/x509/parse-certificate";
import { KryptosKit } from "./KryptosKit";

const MOCKED_NOW = new Date("2024-01-01T08:00:00.000Z");

beforeEach(() => {
  MockDate.set(MOCKED_NOW.toISOString());
});

afterEach(() => {
  MockDate.reset();
});

const NOT_BEFORE = new Date("2024-01-01T00:00:00.000Z");
const EXPIRES_AT = new Date("2025-01-01T00:00:00.000Z");

const b64ToPem = (b64: string): string => {
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`;
};

describe("KryptosKit certificate generation", () => {
  describe("self-signed", () => {
    test("EC sig: our parser, Node X509Certificate, and @peculiar/x509 agree", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://issuer.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      expect(kryptos.x5c).toBeDefined();
      expect(kryptos.x5c).toHaveLength(1);
      expect(kryptos.x5t).toEqual(expect.any(String));
      expect(kryptos.x5tS256).toEqual(expect.any(String));

      const derB64 = kryptos.x5c![0];
      const der = Buffer.from(derB64, "base64");

      // our parser
      const parsed = parseX509Certificate(der);
      expect(parsed.subject.commonName).toBe("https://issuer.example.com");
      expect(parsed.issuer.commonName).toBe("https://issuer.example.com");
      expect(parsed.notBefore.toISOString()).toBe(NOT_BEFORE.toISOString());
      expect(parsed.notAfter.toISOString()).toBe(EXPIRES_AT.toISOString());
      expect(parsed.extensions.keyUsage).toEqual([
        "digitalSignature",
        "keyCertSign",
        "crlSign",
      ]);
      expect(parsed.extensions.basicConstraintsCa).toBe(true);
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "uri", value: "https://issuer.example.com" },
      ]);
      expect(parsed.extensions.subjectKeyIdentifier).toBeDefined();
      // D.3b omits AKI on self-signed certs; see note in D.3d report.
      expect(parsed.extensions.authorityKeyIdentifier).toBeUndefined();

      // Node X509Certificate
      const nodeCert = new X509Certificate(der);
      expect(nodeCert.subject).toContain("https://issuer.example.com");
      expect(nodeCert.issuer).toContain("https://issuer.example.com");

      // @peculiar/x509
      const peculiarCert = new x509.X509Certificate(der);
      expect(peculiarCert.subject).toContain("https://issuer.example.com");
      expect(peculiarCert.issuer).toContain("https://issuer.example.com");
      expect(peculiarCert.notBefore.toISOString()).toBe(NOT_BEFORE.toISOString());
      expect(peculiarCert.notAfter.toISOString()).toBe(EXPIRES_AT.toISOString());
    });

    test("EC sig with subject override", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://issuer.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: {
          mode: "self-signed",
          subject: "my-custom-cn",
        },
      });

      const der = Buffer.from(kryptos.x5c![0], "base64");
      const parsed = parseX509Certificate(der);
      expect(parsed.subject.commonName).toBe("my-custom-cn");
    });

    test("EC sig with organization", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://issuer.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: {
          mode: "self-signed",
          organization: "Lindorm",
        },
      });

      const der = Buffer.from(kryptos.x5c![0], "base64");
      const parsed = parseX509Certificate(der);
      expect(parsed.subject.organization).toBe("Lindorm");
      expect(parsed.subject.commonName).toBe("https://issuer.example.com");
    });

    test("RSA sig (RS256)", () => {
      const kryptos = KryptosKit.generate.sig.rsa({
        algorithm: "RS256",
        issuer: "https://rsa.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      const der = Buffer.from(kryptos.x5c![0], "base64");
      const parsed = parseX509Certificate(der);
      expect(parsed.subject.commonName).toBe("https://rsa.example.com");
      // sha256WithRSAEncryption
      expect(parsed.signatureAlgorithm).toBe("1.2.840.113549.1.1.11");
      expect(parsed.extensions.keyUsage).toEqual([
        "digitalSignature",
        "keyCertSign",
        "crlSign",
      ]);

      // cross-check with Node
      const nodeCert = new X509Certificate(der);
      expect(nodeCert.publicKey.asymmetricKeyType).toBe("rsa");
    });

    test("OKP sig (Ed25519)", () => {
      const kryptos = KryptosKit.generate.sig.okp({
        algorithm: "EdDSA",
        curve: "Ed25519",
        issuer: "https://okp.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      const der = Buffer.from(kryptos.x5c![0], "base64");
      const parsed = parseX509Certificate(der);
      // Ed25519 OID
      expect(parsed.signatureAlgorithm).toBe("1.3.101.112");
      expect(parsed.extensions.keyUsage).toEqual([
        "digitalSignature",
        "keyCertSign",
        "crlSign",
      ]);

      const peculiarCert = new x509.X509Certificate(der);
      expect(peculiarCert.subject).toContain("https://okp.example.com");
    });

    test("enc kryptos (RSA-OAEP) → keyEncipherment + dataEncipherment", () => {
      const kryptos = KryptosKit.generate.enc.rsa({
        algorithm: "RSA-OAEP-256",
        issuer: "https://enc.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      const der = Buffer.from(kryptos.x5c![0], "base64");
      const parsed = parseX509Certificate(der);
      expect(parsed.extensions.keyUsage).toEqual(["keyEncipherment", "dataEncipherment"]);
      expect(parsed.extensions.keyUsage).not.toContain("digitalSignature");
    });

    test("SAN defaulting: URL issuer → URL SAN", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://url.example.com/keys",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      const der = Buffer.from(kryptos.x5c![0], "base64");
      const parsed = parseX509Certificate(der);
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "uri", value: "https://url.example.com/keys" },
      ]);
    });

    test("SAN defaulting: no issuer → URN SAN from kid", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        id: "abc-123",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      const der = Buffer.from(kryptos.x5c![0], "base64");
      const parsed = parseX509Certificate(der);
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "uri", value: "urn:lindorm:kryptos:abc-123" },
      ]);
      expect(parsed.subject.commonName).toBe("abc-123");
    });

    test("SAN explicit override wins", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://issuer.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: {
          mode: "self-signed",
          subjectAlternativeNames: ["https://a.example.com", "https://b.example.com"],
        },
      });

      const der = Buffer.from(kryptos.x5c![0], "base64");
      const parsed = parseX509Certificate(der);
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "uri", value: "https://a.example.com" },
        { type: "uri", value: "https://b.example.com" },
      ]);
    });
  });

  describe("ca-signed", () => {
    const buildCa = () =>
      KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://ca.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

    test("happy path: child has 2-entry chain and verifies against CA anchor", () => {
      const ca = buildCa();
      const child = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://child.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "ca-signed", ca },
      });

      expect(child.x5c).toHaveLength(2);

      const childDer = Buffer.from(child.x5c![0], "base64");
      const parsedChild = parseX509Certificate(childDer);
      const caDer = Buffer.from(ca.x5c![0], "base64");
      const parsedCa = parseX509Certificate(caDer);

      // Issuer of child == subject of CA (byte-compare raw name DER)
      expect(parsedChild.issuer.raw.equals(parsedCa.subject.raw)).toBe(true);

      // AKI of child == SKI of CA
      expect(parsedChild.extensions.authorityKeyIdentifier).toEqual(
        parsedCa.extensions.subjectKeyIdentifier,
      );

      // verifyCertificateChain happy path using CA leaf as trust anchor
      expect(() =>
        child.verifyCertificateChain({ trustAnchors: [ca.x5c![0]] }),
      ).not.toThrow();

      // Cross-verify entire chain with @peculiar/x509
      const peculiarChild = new x509.X509Certificate(childDer);
      const peculiarCa = new x509.X509Certificate(caDer);
      expect(peculiarChild.issuer).toBe(peculiarCa.subject);
    });

    test("guard: CA without private key throws", () => {
      const ca = buildCa();
      const caPublicOnly = KryptosKit.from.jwk(ca.toJWK("public"));

      expect(() =>
        KryptosKit.generate.sig.ec({
          algorithm: "ES256",
          notBefore: NOT_BEFORE,
          expiresAt: EXPIRES_AT,
          certificate: { mode: "ca-signed", ca: caPublicOnly },
        }),
      ).toThrow(KryptosError);
    });

    test("guard: CA without certificateChain throws", () => {
      const caNoChain = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
      });

      expect(() =>
        KryptosKit.generate.sig.ec({
          algorithm: "ES256",
          notBefore: NOT_BEFORE,
          expiresAt: EXPIRES_AT,
          certificate: { mode: "ca-signed", ca: caNoChain },
        }),
      ).toThrow(KryptosError);
    });
  });

  describe("oct keys", () => {
    test("self-signed oct throws 'symmetric keys cannot have certificates'", () => {
      expect(() =>
        KryptosKit.generate.sig.oct({
          algorithm: "HS256",
          certificate: { mode: "self-signed" },
        }),
      ).toThrow("symmetric keys cannot have certificates");
    });
  });

  describe("round-trip", () => {
    test("generated kryptos with cert survives toDB → fromDb", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://rt.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      const db = kryptos.toDB();
      expect(db.certificateChain).toHaveLength(1);

      const restored = KryptosKit.from.db(db);
      expect(restored.x5c).toEqual(kryptos.x5c);
      expect(restored.x5t).toBe(kryptos.x5t);
      expect(restored.x5tS256).toBe(kryptos.x5tS256);
    });

    test("PEM chain can be parsed back", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://pem.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      const pem = b64ToPem(kryptos.x5c![0]);
      const nodeCert = new X509Certificate(pem);
      expect(nodeCert.subject).toContain("https://pem.example.com");
    });
  });

  describe("generateAsync parity", () => {
    test("async EC sig with self-signed cert produces valid chain", async () => {
      const kryptos = await KryptosKit.generateAsync.sig.ec({
        algorithm: "ES256",
        issuer: "https://async.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      expect(kryptos.x5c).toHaveLength(1);
      const der = Buffer.from(kryptos.x5c![0], "base64");
      const parsed = parseX509Certificate(der);
      expect(parsed.subject.commonName).toBe("https://async.example.com");
      expect(parsed.extensions.keyUsage).toEqual([
        "digitalSignature",
        "keyCertSign",
        "crlSign",
      ]);
    });
  });
});
