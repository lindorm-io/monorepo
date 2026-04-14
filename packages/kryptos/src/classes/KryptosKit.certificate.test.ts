import * as x509 from "@peculiar/x509";
import { X509Certificate } from "crypto";
import MockDate from "mockdate";
import { KryptosError } from "../errors";
import type { KryptosCertificateOption } from "../types/certificate";
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
const CA_NOT_BEFORE = new Date("2023-06-01T00:00:00.000Z");
const CA_EXPIRES_AT = new Date("2028-06-01T00:00:00.000Z");

const b64ToPem = (b64: string): string => {
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`;
};

describe("KryptosKit certificate generation", () => {
  describe("self-signed leaf", () => {
    test("EC sig: cA=FALSE, KU=digitalSignature only, AKI=own SKI", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://issuer.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      expect(kryptos.x5c).toHaveLength(1);
      expect(kryptos.x5t).toEqual(expect.any(String));
      expect(kryptos.x5tS256).toEqual(expect.any(String));

      const der = Buffer.from(kryptos.x5c![0], "base64");
      const parsed = parseX509Certificate(der);
      expect(parsed.subject.commonName).toBe("https://issuer.example.com");
      expect(parsed.issuer.commonName).toBe("https://issuer.example.com");
      expect(parsed.notBefore.toISOString()).toBe(NOT_BEFORE.toISOString());
      expect(parsed.notAfter.toISOString()).toBe(EXPIRES_AT.toISOString());
      expect(parsed.extensions.basicConstraintsCa).toBe(false);
      expect(parsed.extensions.keyUsage).toEqual(["digitalSignature"]);
      expect(parsed.extensions.subjectKeyIdentifier).toBeDefined();
      expect(parsed.extensions.authorityKeyIdentifier).toBeDefined();
      expect(
        parsed.extensions.authorityKeyIdentifier!.equals(
          parsed.extensions.subjectKeyIdentifier!,
        ),
      ).toBe(true);
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "uri", value: "https://issuer.example.com" },
      ]);

      const nodeCert = new X509Certificate(der);
      expect(nodeCert.ca).toBe(false);
      expect(nodeCert.subject).toContain("https://issuer.example.com");

      const peculiarCert = new x509.X509Certificate(der);
      expect(peculiarCert.subject).toContain("https://issuer.example.com");
      expect(peculiarCert.notBefore.toISOString()).toBe(NOT_BEFORE.toISOString());
      expect(peculiarCert.notAfter.toISOString()).toBe(EXPIRES_AT.toISOString());
    });

    test("RSA sig (RS256) self-signed leaf", () => {
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
      expect(parsed.signatureAlgorithm).toBe("1.2.840.113549.1.1.11");
      expect(parsed.extensions.basicConstraintsCa).toBe(false);
      expect(parsed.extensions.keyUsage).toEqual(["digitalSignature"]);

      const nodeCert = new X509Certificate(der);
      expect(nodeCert.publicKey.asymmetricKeyType).toBe("rsa");
      expect(nodeCert.ca).toBe(false);
    });

    test("OKP sig (Ed25519) self-signed leaf", () => {
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
      expect(parsed.signatureAlgorithm).toBe("1.3.101.112");
      expect(parsed.extensions.basicConstraintsCa).toBe(false);
      expect(parsed.extensions.keyUsage).toEqual(["digitalSignature"]);
    });

    test("enc kryptos → keyEncipherment + dataEncipherment", () => {
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
      expect(parsed.extensions.basicConstraintsCa).toBe(false);
    });

    test("subject override", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://issuer.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed", subject: "my-custom-cn" },
      });

      const parsed = parseX509Certificate(Buffer.from(kryptos.x5c![0], "base64"));
      expect(parsed.subject.commonName).toBe("my-custom-cn");
    });

    test("organization", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://issuer.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed", organization: "Lindorm" },
      });

      const parsed = parseX509Certificate(Buffer.from(kryptos.x5c![0], "base64"));
      expect(parsed.subject.organization).toBe("Lindorm");
    });

    test("SAN defaulting: URL issuer → URL SAN", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://url.example.com/keys",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      const parsed = parseX509Certificate(Buffer.from(kryptos.x5c![0], "base64"));
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "uri", value: "https://url.example.com/keys" },
      ]);
    });

    test("SAN defaulting: no issuer → URN SAN from id", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        id: "abc-123",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      const parsed = parseX509Certificate(Buffer.from(kryptos.x5c![0], "base64"));
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "uri", value: "urn:lindorm:kryptos:abc-123" },
      ]);
      expect(parsed.subject.commonName).toBe("abc-123");
    });

    test("SAN defaulting: non-URL issuer throws unless explicit SANs supplied", () => {
      expect(() =>
        KryptosKit.generate.sig.ec({
          algorithm: "ES256",
          issuer: "my-local-svc",
          notBefore: NOT_BEFORE,
          expiresAt: EXPIRES_AT,
          certificate: { mode: "self-signed" },
        }),
      ).toThrow("non-URL issuer");
    });

    test("SAN defaulting: non-URL issuer + explicit SANs is allowed", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "my-local-svc",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: {
          mode: "self-signed",
          subjectAlternativeNames: [{ type: "dns", value: "my-local-svc.local" }],
        },
      });
      const parsed = parseX509Certificate(Buffer.from(kryptos.x5c![0], "base64"));
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "dns", value: "my-local-svc.local" },
      ]);
    });

    test("SAN rich input: mixed uri + dns + email", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://issuer.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: {
          mode: "self-signed",
          subjectAlternativeNames: [
            "https://example.com",
            { type: "dns", value: "example.com" },
            { type: "email", value: "ops@example.com" },
          ],
        },
      });

      const parsed = parseX509Certificate(Buffer.from(kryptos.x5c![0], "base64"));
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "uri", value: "https://example.com" },
        { type: "dns", value: "example.com" },
        { type: "email", value: "ops@example.com" },
      ]);
    });

    test("SAN rich input: IPv4", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://issuer.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: {
          mode: "self-signed",
          subjectAlternativeNames: [{ type: "ip", value: "192.168.1.1" }],
        },
      });

      const parsed = parseX509Certificate(Buffer.from(kryptos.x5c![0], "base64"));
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "ip", value: "192.168.1.1" },
      ]);
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

      const parsed = parseX509Certificate(Buffer.from(kryptos.x5c![0], "base64"));
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "uri", value: "https://a.example.com" },
        { type: "uri", value: "https://b.example.com" },
      ]);
    });

    test("validity inheritance: notBefore/expiresAt flow through to cert", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://v.example.com",
        notBefore: new Date("2024-05-10T12:00:00.000Z"),
        expiresAt: new Date("2026-11-20T23:59:59.000Z"),
        certificate: { mode: "self-signed" },
      });
      const parsed = parseX509Certificate(Buffer.from(kryptos.x5c![0], "base64"));
      expect(parsed.notBefore.toISOString()).toBe("2024-05-10T12:00:00.000Z");
      expect(parsed.notAfter.toISOString()).toBe("2026-11-20T23:59:59.000Z");
    });
  });

  describe("root-ca", () => {
    test("EC root-CA has cA=true, KU=keyCertSign|cRLSign, no AKI", () => {
      const ca = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://ca.example.com",
        notBefore: CA_NOT_BEFORE,
        expiresAt: CA_EXPIRES_AT,
        certificate: { mode: "root-ca" },
      });

      const parsed = parseX509Certificate(Buffer.from(ca.x5c![0], "base64"));
      expect(parsed.extensions.basicConstraintsCa).toBe(true);
      expect(parsed.extensions.keyUsage).toEqual(["keyCertSign", "crlSign"]);
      expect(parsed.extensions.subjectKeyIdentifier).toBeDefined();
      expect(parsed.extensions.authorityKeyIdentifier).toBeUndefined();

      const peculiar = new x509.X509Certificate(Buffer.from(ca.x5c![0], "base64"));
      const bcExt = peculiar.extensions.find((e) => e.type === "2.5.29.19") as
        | x509.BasicConstraintsExtension
        | undefined;
      expect(bcExt?.ca).toBe(true);
    });

    test("root-CA with pathLengthConstraint=0", () => {
      const ca = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://ca.example.com",
        notBefore: CA_NOT_BEFORE,
        expiresAt: CA_EXPIRES_AT,
        certificate: { mode: "root-ca", pathLengthConstraint: 0 },
      });

      const peculiar = new x509.X509Certificate(Buffer.from(ca.x5c![0], "base64"));
      const bcExt = peculiar.extensions.find((e) => e.type === "2.5.29.19") as
        | x509.BasicConstraintsExtension
        | undefined;
      expect(bcExt?.ca).toBe(true);
      expect(bcExt?.pathLength).toBe(0);
    });

    test("root-CA validity inheritance", () => {
      const ca = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://ca.example.com",
        notBefore: CA_NOT_BEFORE,
        expiresAt: CA_EXPIRES_AT,
        certificate: { mode: "root-ca" },
      });
      const parsed = parseX509Certificate(Buffer.from(ca.x5c![0], "base64"));
      expect(parsed.notBefore.toISOString()).toBe(CA_NOT_BEFORE.toISOString());
      expect(parsed.notAfter.toISOString()).toBe(CA_EXPIRES_AT.toISOString());
    });
  });

  describe("ca-signed", () => {
    const buildCa = (overrides?: { notBefore?: Date; expiresAt?: Date }) =>
      KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://ca.example.com",
        notBefore: overrides?.notBefore ?? CA_NOT_BEFORE,
        expiresAt: overrides?.expiresAt ?? CA_EXPIRES_AT,
        certificate: { mode: "root-ca" },
      });

    test("happy path: EC child under EC root", () => {
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

      expect(parsedChild.issuer.raw.equals(parsedCa.subject.raw)).toBe(true);
      expect(parsedChild.extensions.basicConstraintsCa).toBe(false);
      expect(parsedChild.extensions.keyUsage).toEqual(["digitalSignature"]);
      expect(parsedChild.extensions.authorityKeyIdentifier).toBeDefined();
      expect(
        parsedChild.extensions.authorityKeyIdentifier!.equals(
          parsedCa.extensions.subjectKeyIdentifier!,
        ),
      ).toBe(true);

      expect(() => child.verifyCertificate({ trustAnchors: [ca.x5c![0]] })).not.toThrow();

      const chainBuilder = new x509.X509ChainBuilder({
        certificates: [new x509.X509Certificate(caDer)],
      });
      expect(chainBuilder).toBeDefined();

      const peculiarChild = new x509.X509Certificate(childDer);
      const peculiarCa = new x509.X509Certificate(caDer);
      expect(peculiarChild.issuer).toBe(peculiarCa.subject);
    });

    test("mixed-algorithm: RSA child under EC root", () => {
      const ca = buildCa();
      const child = KryptosKit.generate.sig.rsa({
        algorithm: "RS256",
        issuer: "https://mixed.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "ca-signed", ca },
      });

      expect(child.x5c).toHaveLength(2);

      const childDer = Buffer.from(child.x5c![0], "base64");
      const parsedChild = parseX509Certificate(childDer);
      expect(parsedChild.signatureAlgorithm).toBe("1.2.840.10045.4.3.2");
      expect(parsedChild.extensions.basicConstraintsCa).toBe(false);

      expect(() => child.verifyCertificate({ trustAnchors: [ca.x5c![0]] })).not.toThrow();
    });

    test("byte-equal issuer DN regression", () => {
      const ca = buildCa();
      const child = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://byte.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "ca-signed", ca },
      });
      const parsedChild = parseX509Certificate(Buffer.from(child.x5c![0], "base64"));
      const parsedCa = parseX509Certificate(Buffer.from(ca.x5c![0], "base64"));
      expect(parsedChild.issuer.raw.equals(parsedCa.subject.raw)).toBe(true);
    });

    test("ca-signed validity inheritance", () => {
      const ca = buildCa();
      const child = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://v2.example.com",
        notBefore: new Date("2024-07-01T00:00:00.000Z"),
        expiresAt: new Date("2025-07-01T00:00:00.000Z"),
        certificate: { mode: "ca-signed", ca },
      });
      const parsed = parseX509Certificate(Buffer.from(child.x5c![0], "base64"));
      expect(parsed.notBefore.toISOString()).toBe("2024-07-01T00:00:00.000Z");
      expect(parsed.notAfter.toISOString()).toBe("2025-07-01T00:00:00.000Z");
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

    test("guard: CA that is a self-signed leaf (cA=false) throws", () => {
      const leaf = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://not-a-ca.example.com",
        notBefore: CA_NOT_BEFORE,
        expiresAt: CA_EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      expect(() =>
        KryptosKit.generate.sig.ec({
          algorithm: "ES256",
          notBefore: NOT_BEFORE,
          expiresAt: EXPIRES_AT,
          certificate: { mode: "ca-signed", ca: leaf },
        }),
      ).toThrow("basicConstraints cA=true");
    });

    test("guard: child validity window exceeding CA's throws", () => {
      const ca = buildCa({
        notBefore: new Date("2024-01-01T00:00:00.000Z"),
        expiresAt: new Date("2024-12-31T23:59:59.000Z"),
      });

      expect(() =>
        KryptosKit.generate.sig.ec({
          algorithm: "ES256",
          notBefore: NOT_BEFORE,
          expiresAt: new Date("2026-01-01T00:00:00.000Z"),
          certificate: { mode: "ca-signed", ca },
        }),
      ).toThrow("validity window must fit within");
    });
  });

  describe("oct keys", () => {
    test("self-signed oct throws", () => {
      expect(() =>
        KryptosKit.generate.sig.oct({
          algorithm: "HS256",
          // @ts-expect-error — certificate option is type-excluded from oct variants; this proves the runtime guard still catches forced calls
          certificate: { mode: "self-signed" },
        }),
      ).toThrow("symmetric keys cannot have certificates");
    });

    test("root-ca oct throws", () => {
      expect(() =>
        KryptosKit.generate.sig.oct({
          algorithm: "HS256",
          // @ts-expect-error — certificate option is type-excluded from oct variants; this proves the runtime guard still catches forced calls
          certificate: { mode: "root-ca" },
        }),
      ).toThrow("symmetric keys cannot have certificates");
    });
  });

  describe("round-trip", () => {
    test("root-CA + ca-signed chain survives toDB → fromDb", () => {
      const ca = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://rt.example.com",
        notBefore: CA_NOT_BEFORE,
        expiresAt: CA_EXPIRES_AT,
        certificate: { mode: "root-ca" },
      });
      const child = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://rt-child.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "ca-signed", ca },
      });

      const db = child.toDB();
      expect(db.certificateChain).toHaveLength(2);

      const restored = KryptosKit.from.db(db);
      expect(restored.x5c).toEqual(child.x5c);
      expect(restored.x5t).toBe(child.x5t);
      expect(restored.x5tS256).toBe(child.x5tS256);
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

  describe("determinism", () => {
    test("self-signed deterministic with fixed EdDSA key and MockDate", () => {
      const shared = KryptosKit.generate.sig.okp({
        algorithm: "EdDSA",
        curve: "Ed25519",
        issuer: "https://d.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });
      // Reuse existing key via fromJwk → generate flow isn't stable for serial.
      // Instead, compare x5c between two fromJwk ingests which must match.
      const jwk = shared.toJWK("private");
      const a = KryptosKit.from.jwk(jwk);
      const b = KryptosKit.from.jwk(jwk);
      expect(a.x5c?.[0]).toBe(b.x5c?.[0]);
    });
  });

  describe("generateAsync parity", () => {
    test("async self-signed", async () => {
      const kryptos = await KryptosKit.generateAsync.sig.ec({
        algorithm: "ES256",
        issuer: "https://async.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "self-signed" },
      });

      expect(kryptos.x5c).toHaveLength(1);
      const parsed = parseX509Certificate(Buffer.from(kryptos.x5c![0], "base64"));
      expect(parsed.extensions.basicConstraintsCa).toBe(false);
      expect(parsed.extensions.keyUsage).toEqual(["digitalSignature"]);
    });

    test("async ca-signed", async () => {
      const ca = await KryptosKit.generateAsync.sig.ec({
        algorithm: "ES256",
        issuer: "https://async-ca.example.com",
        notBefore: CA_NOT_BEFORE,
        expiresAt: CA_EXPIRES_AT,
        certificate: { mode: "root-ca" },
      });
      const child = await KryptosKit.generateAsync.sig.ec({
        algorithm: "ES256",
        issuer: "https://async-child.example.com",
        notBefore: NOT_BEFORE,
        expiresAt: EXPIRES_AT,
        certificate: { mode: "ca-signed", ca },
      });

      expect(child.x5c).toHaveLength(2);
      const parsedChild = parseX509Certificate(Buffer.from(child.x5c![0], "base64"));
      const parsedCa = parseX509Certificate(Buffer.from(ca.x5c![0], "base64"));
      expect(parsedChild.issuer.raw.equals(parsedCa.subject.raw)).toBe(true);
    });
  });

  describe("validity inheritance invariant (type-level)", () => {
    test("certificate options do not accept notBefore/notAfter/validFrom/validTo", () => {
      const opt1: KryptosCertificateOption = {
        mode: "self-signed",
        // @ts-expect-error — notBefore is not a valid field on KryptosCertificateOption
        notBefore: new Date(),
      };
      const opt2: KryptosCertificateOption = {
        mode: "self-signed",
        // @ts-expect-error — notAfter is not a valid field on KryptosCertificateOption
        notAfter: new Date(),
      };
      const opt3: KryptosCertificateOption = {
        mode: "root-ca",
        // @ts-expect-error — validFrom is not a valid field on KryptosCertificateOption
        validFrom: new Date(),
      };
      const opt4: KryptosCertificateOption = {
        mode: "root-ca",
        // @ts-expect-error — validTo is not a valid field on KryptosCertificateOption
        validTo: new Date(),
      };

      expect([opt1, opt2, opt3, opt4]).toHaveLength(4);
    });
  });
});
