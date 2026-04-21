import * as x509 from "@peculiar/x509";
import { createPublicKey, generateKeyPairSync, X509Certificate } from "crypto";
import { KryptosType } from "../../../types";
import { generateX509Certificate } from "./generate-x509";
import { parseX509Certificate } from "./parse-certificate";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const toU8 = (buf: Buffer): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(buf.byteLength));
  out.set(buf);
  return out;
};

type KeyPair = {
  type: KryptosType;
  privateKey: Buffer;
  publicKey: Buffer;
};

const ecKeyPair = (namedCurve: "P-256" | "P-384" | "P-521"): KeyPair => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve,
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });
  return {
    type: "EC",
    privateKey: privateKey as unknown as Buffer,
    publicKey: publicKey as unknown as Buffer,
  };
};

const rsaKeyPair = (): KeyPair => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { format: "der", type: "pkcs1" },
    publicKeyEncoding: { format: "der", type: "pkcs1" },
  });
  return {
    type: "RSA",
    privateKey: privateKey as unknown as Buffer,
    publicKey: publicKey as unknown as Buffer,
  };
};

const ed25519KeyPair = (): KeyPair => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });
  return {
    type: "OKP",
    privateKey: privateKey as unknown as Buffer,
    publicKey: publicKey as unknown as Buffer,
  };
};

const ed448KeyPair = (): KeyPair => {
  const { privateKey, publicKey } = generateKeyPairSync("ed448", {
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });
  return {
    type: "OKP",
    privateKey: privateKey as unknown as Buffer,
    publicKey: publicKey as unknown as Buffer,
  };
};

const BASE_DATE = new Date("2024-01-01T08:00:00.000Z");
const NOT_BEFORE = new Date("2024-01-01T00:00:00.000Z");
const NOT_AFTER = new Date("2025-01-01T00:00:00.000Z");
const SERIAL = Buffer.from("1122334455667788991122334455667700".padEnd(32, "0"), "hex");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE_DATE);
});

afterEach(() => {
  vi.useRealTimers();
});

const getSubjectSpki = (pair: KeyPair): Buffer => {
  const sourceType = pair.type === "RSA" ? "pkcs1" : "spki";
  return createPublicKey({
    key: pair.publicKey,
    format: "der",
    type: sourceType,
  }).export({ format: "der", type: "spki" }) as Buffer;
};

const assertRootCaSelfSigned = (der: Buffer, subjectPair: KeyPair): void => {
  const nodeCert = new X509Certificate(der);
  expect(nodeCert.subject).toContain("CN=example.test");
  expect(nodeCert.issuer).toContain("CN=example.test");
  expect(nodeCert.ca).toBe(true);
  expect(new Date(nodeCert.validFrom).getTime()).toBe(NOT_BEFORE.getTime());
  expect(new Date(nodeCert.validTo).getTime()).toBe(NOT_AFTER.getTime());
  expect(nodeCert.verify(nodeCert.publicKey)).toBe(true);

  const exportedSpki = nodeCert.publicKey.export({
    format: "der",
    type: "spki",
  }) as Buffer;
  expect(exportedSpki.equals(getSubjectSpki(subjectPair))).toBe(true);

  const peculiar = new x509.X509Certificate(toU8(der));
  expect(peculiar.subject).toContain("CN=example.test");
  expect(peculiar.issuer).toContain("CN=example.test");
  const extensionOids = peculiar.extensions.map((e) => e.type);
  expect(extensionOids).toEqual(
    expect.arrayContaining(["2.5.29.19", "2.5.29.15", "2.5.29.14", "2.5.29.17"]),
  );
};

describe("generateX509Certificate", () => {
  describe("root-ca happy paths", () => {
    test("ES256 root-ca", () => {
      const pair = ecKeyPair("P-256");
      const der = generateX509Certificate({
        subjectKryptos: { ...pair, algorithm: "ES256" },
        issuerKryptos: { ...pair, algorithm: "ES256" },
        subject: { commonName: "example.test", organization: "Lindorm" },
        issuer: { commonName: "example.test", organization: "Lindorm" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: true },
        keyUsage: ["keyCertSign", "cRLSign"],
        subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
        serialNumber: SERIAL,
      });
      assertRootCaSelfSigned(der, pair);
    });

    test("ES384 root-ca", () => {
      const pair = ecKeyPair("P-384");
      const der = generateX509Certificate({
        subjectKryptos: { ...pair, algorithm: "ES384" },
        issuerKryptos: { ...pair, algorithm: "ES384" },
        subject: { commonName: "example.test" },
        issuer: { commonName: "example.test" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: true },
        keyUsage: ["keyCertSign", "cRLSign"],
        subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
        serialNumber: SERIAL,
      });
      assertRootCaSelfSigned(der, pair);
    });

    test("RS256 root-ca", () => {
      const pair = rsaKeyPair();
      const der = generateX509Certificate({
        subjectKryptos: { ...pair, algorithm: "RS256" },
        issuerKryptos: { ...pair, algorithm: "RS256" },
        subject: { commonName: "example.test", organization: "Lindorm" },
        issuer: { commonName: "example.test", organization: "Lindorm" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: true },
        keyUsage: ["keyCertSign", "cRLSign"],
        subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
        serialNumber: SERIAL,
      });
      assertRootCaSelfSigned(der, pair);
    });

    test("Ed25519 root-ca", () => {
      const pair = ed25519KeyPair();
      const der = generateX509Certificate({
        subjectKryptos: { ...pair, algorithm: "EdDSA" },
        issuerKryptos: { ...pair, algorithm: "EdDSA" },
        subject: { commonName: "example.test" },
        issuer: { commonName: "example.test" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: true },
        keyUsage: ["keyCertSign", "cRLSign"],
        subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
        serialNumber: SERIAL,
      });
      assertRootCaSelfSigned(der, pair);
    });

    test("Ed448 root-ca", () => {
      const pair = ed448KeyPair();
      const der = generateX509Certificate({
        subjectKryptos: { ...pair, algorithm: "EdDSA" },
        issuerKryptos: { ...pair, algorithm: "EdDSA" },
        subject: { commonName: "example.test" },
        issuer: { commonName: "example.test" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: true },
        keyUsage: ["keyCertSign", "cRLSign"],
        subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
        serialNumber: SERIAL,
      });
      assertRootCaSelfSigned(der, pair);
    });

    test("self-signed leaf (non-CA) with digitalSignature only", () => {
      const pair = ecKeyPair("P-256");
      const der = generateX509Certificate({
        subjectKryptos: { ...pair, algorithm: "ES256" },
        issuerKryptos: { ...pair, algorithm: "ES256" },
        subject: { commonName: "leaf.test" },
        issuer: { commonName: "leaf.test" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: false },
        keyUsage: ["digitalSignature"],
        subjectAlternativeNames: [{ type: "uri", value: "https://leaf.test" }],
        serialNumber: SERIAL,
      });

      const nodeCert = new X509Certificate(der);
      expect(nodeCert.ca).toBe(false);

      const peculiar = new x509.X509Certificate(toU8(der));
      const kuExt = peculiar.extensions.find((e) => e.type === "2.5.29.15") as
        | x509.KeyUsagesExtension
        | undefined;
      expect(kuExt).toBeDefined();
      expect((kuExt!.usages & x509.KeyUsageFlags.digitalSignature) !== 0).toBe(true);
      expect((kuExt!.usages & x509.KeyUsageFlags.keyCertSign) !== 0).toBe(false);
    });

    test("keyEncipherment + dataEncipherment leaf", () => {
      const pair = rsaKeyPair();
      const der = generateX509Certificate({
        subjectKryptos: { ...pair, algorithm: "RS256" },
        issuerKryptos: { ...pair, algorithm: "RS256" },
        subject: { commonName: "enc.test" },
        issuer: { commonName: "enc.test" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: false },
        keyUsage: ["keyEncipherment", "dataEncipherment"],
        subjectAlternativeNames: [{ type: "uri", value: "https://enc.test" }],
        serialNumber: SERIAL,
      });

      const peculiar = new x509.X509Certificate(toU8(der));
      const kuExt = peculiar.extensions.find((e) => e.type === "2.5.29.15") as
        | x509.KeyUsagesExtension
        | undefined;
      expect(kuExt).toBeDefined();
      expect((kuExt!.usages & x509.KeyUsageFlags.keyEncipherment) !== 0).toBe(true);
      expect((kuExt!.usages & x509.KeyUsageFlags.dataEncipherment) !== 0).toBe(true);
    });
  });

  describe("CA-signed chain", () => {
    test("EC root-CA signs EC leaf with byte-equal issuer DN", () => {
      const caPair = ecKeyPair("P-256");
      const leafPair = ecKeyPair("P-256");

      const caDer = generateX509Certificate({
        subjectKryptos: { ...caPair, algorithm: "ES256" },
        issuerKryptos: { ...caPair, algorithm: "ES256" },
        subject: { commonName: "root.test", organization: "Lindorm" },
        issuer: { commonName: "root.test", organization: "Lindorm" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: true },
        keyUsage: ["keyCertSign", "cRLSign"],
        subjectAlternativeNames: [{ type: "uri", value: "https://root.test" }],
        serialNumber: SERIAL,
      });

      const nodeCa = new X509Certificate(caDer);
      expect(nodeCa.ca).toBe(true);

      const peculiarCa = new x509.X509Certificate(toU8(caDer));
      const caSkiExt = peculiarCa.extensions.find((e) => e.type === "2.5.29.14") as
        | x509.SubjectKeyIdentifierExtension
        | undefined;
      if (!caSkiExt) throw new Error("CA missing SKI extension");
      const caSki = Buffer.from(caSkiExt.keyId, "hex");

      const leafSerial = Buffer.from("0102030405060708090a0b0c0d0e0f10", "hex");
      const leafDer = generateX509Certificate({
        subjectKryptos: { ...leafPair, algorithm: "ES256" },
        issuerKryptos: { ...caPair, algorithm: "ES256" },
        subject: { commonName: "leaf.test", organization: "Lindorm" },
        issuer: { raw: Buffer.from(peculiarCa.subjectName.toArrayBuffer()) },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: false },
        keyUsage: ["digitalSignature"],
        subjectAlternativeNames: [{ type: "uri", value: "https://leaf.test" }],
        authorityKeyIdentifier: caSki,
        serialNumber: leafSerial,
      });

      const nodeLeaf = new X509Certificate(leafDer);
      expect(nodeLeaf.ca).toBe(false);
      expect(nodeLeaf.subject).toContain("CN=leaf.test");
      expect(nodeLeaf.issuer).toContain("CN=root.test");
      expect(nodeLeaf.verify(nodeCa.publicKey)).toBe(true);

      const peculiarLeaf = new x509.X509Certificate(toU8(leafDer));
      expect(peculiarLeaf.subject).toContain("CN=leaf.test");
      expect(peculiarLeaf.issuer).toContain("CN=root.test");
      const leafAkiExt = peculiarLeaf.extensions.find((e) => e.type === "2.5.29.35") as
        | x509.AuthorityKeyIdentifierExtension
        | undefined;
      expect(leafAkiExt).toBeDefined();
      expect(leafAkiExt?.keyId).toBe(caSki.toString("hex"));
    });
  });

  describe("RFC 5280 enforcement", () => {
    test("keyCertSign with ca=false throws", () => {
      const pair = ecKeyPair("P-256");
      expect(() =>
        generateX509Certificate({
          subjectKryptos: { ...pair, algorithm: "ES256" },
          issuerKryptos: { ...pair, algorithm: "ES256" },
          subject: { commonName: "bad.test" },
          issuer: { commonName: "bad.test" },
          notBefore: NOT_BEFORE,
          notAfter: NOT_AFTER,
          basicConstraints: { ca: false },
          keyUsage: ["keyCertSign"],
          subjectAlternativeNames: [],
          serialNumber: SERIAL,
        }),
      ).toThrow("keyCertSign or cRLSign requires basicConstraints.ca=true");
    });

    test("cRLSign with ca=false throws", () => {
      const pair = ecKeyPair("P-256");
      expect(() =>
        generateX509Certificate({
          subjectKryptos: { ...pair, algorithm: "ES256" },
          issuerKryptos: { ...pair, algorithm: "ES256" },
          subject: { commonName: "bad.test" },
          issuer: { commonName: "bad.test" },
          notBefore: NOT_BEFORE,
          notAfter: NOT_AFTER,
          basicConstraints: { ca: false },
          keyUsage: ["cRLSign"],
          subjectAlternativeNames: [],
          serialNumber: SERIAL,
        }),
      ).toThrow("keyCertSign or cRLSign requires basicConstraints.ca=true");
    });

    test("empty keyUsage throws", () => {
      const pair = ecKeyPair("P-256");
      expect(() =>
        generateX509Certificate({
          subjectKryptos: { ...pair, algorithm: "ES256" },
          issuerKryptos: { ...pair, algorithm: "ES256" },
          subject: { commonName: "bad.test" },
          issuer: { commonName: "bad.test" },
          notBefore: NOT_BEFORE,
          notAfter: NOT_AFTER,
          basicConstraints: { ca: false },
          keyUsage: [],
          subjectAlternativeNames: [],
          serialNumber: SERIAL,
        }),
      ).toThrow("keyUsage must contain at least one flag");
    });

    test("pathLengthConstraint with ca=false throws", () => {
      const pair = ecKeyPair("P-256");
      expect(() =>
        generateX509Certificate({
          subjectKryptos: { ...pair, algorithm: "ES256" },
          issuerKryptos: { ...pair, algorithm: "ES256" },
          subject: { commonName: "bad.test" },
          issuer: { commonName: "bad.test" },
          notBefore: NOT_BEFORE,
          notAfter: NOT_AFTER,
          basicConstraints: { ca: false, pathLengthConstraint: 1 },
          keyUsage: ["digitalSignature"],
          subjectAlternativeNames: [],
          serialNumber: SERIAL,
        }),
      ).toThrow("pathLengthConstraint is only valid when ca=true");
    });
  });

  describe("byte-identical determinism", () => {
    test("same inputs produce byte-equal DER", () => {
      const pair = ecKeyPair("P-256");
      const edPair = ed25519KeyPair();

      const options = {
        subjectKryptos: { ...edPair, algorithm: "EdDSA" as const },
        issuerKryptos: { ...edPair, algorithm: "EdDSA" as const },
        subject: { commonName: "example.test" },
        issuer: { commonName: "example.test" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: true },
        keyUsage: ["keyCertSign", "cRLSign"] as const,
        subjectAlternativeNames: [
          { type: "uri" as const, value: "https://example.test/a" },
        ],
        serialNumber: SERIAL,
      };

      const a = generateX509Certificate(options);
      const b = generateX509Certificate(options);

      expect(a.equals(b)).toBe(true);

      const c = generateX509Certificate({
        ...options,
        serialNumber: Buffer.from("ffeeddccbbaa99887766554433221100", "hex"),
      });
      expect(a.equals(c)).toBe(false);

      expect(pair.type).toBe("EC");
    });
  });

  describe("error paths", () => {
    test("PS256 throws deferred error", () => {
      const pair = rsaKeyPair();
      expect(() =>
        generateX509Certificate({
          subjectKryptos: { ...pair, algorithm: "PS256" },
          issuerKryptos: { ...pair, algorithm: "PS256" },
          subject: { commonName: "example.test" },
          issuer: { commonName: "example.test" },
          notBefore: NOT_BEFORE,
          notAfter: NOT_AFTER,
          basicConstraints: { ca: true },
          keyUsage: ["keyCertSign", "cRLSign"],
          subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
          serialNumber: SERIAL,
        }),
      ).toThrow("RSA-PSS signatures (PS256) for X.509 are not yet supported");
    });

    test("oct key type throws", () => {
      expect(() =>
        generateX509Certificate({
          subjectKryptos: {
            publicKey: Buffer.alloc(32),
            type: "oct",
            algorithm: "HS256",
          },
          issuerKryptos: {
            privateKey: Buffer.alloc(32),
            type: "oct",
            algorithm: "HS256",
          },
          subject: { commonName: "example.test" },
          issuer: { commonName: "example.test" },
          notBefore: NOT_BEFORE,
          notAfter: NOT_AFTER,
          basicConstraints: { ca: false },
          keyUsage: ["digitalSignature"],
          subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
          serialNumber: SERIAL,
        }),
      ).toThrow("X.509 certificates require asymmetric keys");
    });

    test("notBefore after notAfter throws", () => {
      const pair = ecKeyPair("P-256");
      expect(() =>
        generateX509Certificate({
          subjectKryptos: { ...pair, algorithm: "ES256" },
          issuerKryptos: { ...pair, algorithm: "ES256" },
          subject: { commonName: "example.test" },
          issuer: { commonName: "example.test" },
          notBefore: NOT_AFTER,
          notAfter: NOT_BEFORE,
          basicConstraints: { ca: false },
          keyUsage: ["digitalSignature"],
          subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
          serialNumber: SERIAL,
        }),
      ).toThrow("notBefore must be strictly before notAfter");
    });

    test("notBefore equal to notAfter throws", () => {
      const pair = ecKeyPair("P-256");
      expect(() =>
        generateX509Certificate({
          subjectKryptos: { ...pair, algorithm: "ES256" },
          issuerKryptos: { ...pair, algorithm: "ES256" },
          subject: { commonName: "example.test" },
          issuer: { commonName: "example.test" },
          notBefore: NOT_BEFORE,
          notAfter: NOT_BEFORE,
          basicConstraints: { ca: false },
          keyUsage: ["digitalSignature"],
          subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
          serialNumber: SERIAL,
        }),
      ).toThrow("notBefore must be strictly before notAfter");
    });

    test("empty serial number throws", () => {
      const pair = ecKeyPair("P-256");
      expect(() =>
        generateX509Certificate({
          subjectKryptos: { ...pair, algorithm: "ES256" },
          issuerKryptos: { ...pair, algorithm: "ES256" },
          subject: { commonName: "example.test" },
          issuer: { commonName: "example.test" },
          notBefore: NOT_BEFORE,
          notAfter: NOT_AFTER,
          basicConstraints: { ca: false },
          keyUsage: ["digitalSignature"],
          subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
          serialNumber: Buffer.alloc(0),
        }),
      ).toThrow("serialNumber must be non-empty");
    });

    test("randomly generated serial when omitted", () => {
      const pair = ed25519KeyPair();
      const der = generateX509Certificate({
        subjectKryptos: { ...pair, algorithm: "EdDSA" },
        issuerKryptos: { ...pair, algorithm: "EdDSA" },
        subject: { commonName: "example.test" },
        issuer: { commonName: "example.test" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: false },
        keyUsage: ["digitalSignature"],
        subjectAlternativeNames: [{ type: "uri", value: "https://example.test/a" }],
      });
      const nodeCert = new X509Certificate(der);
      expect(nodeCert.serialNumber.length).toBeGreaterThan(0);
    });
  });

  describe("subject alternative name round-trip", () => {
    test("mixed uri+dns+email list round-trips through parseX509Certificate", () => {
      const pair = ecKeyPair("P-256");
      const der = generateX509Certificate({
        subjectKryptos: { ...pair, algorithm: "ES256" },
        issuerKryptos: { ...pair, algorithm: "ES256" },
        subject: { commonName: "mixed.test" },
        issuer: { commonName: "mixed.test" },
        notBefore: NOT_BEFORE,
        notAfter: NOT_AFTER,
        basicConstraints: { ca: false },
        keyUsage: ["digitalSignature"],
        subjectAlternativeNames: [
          { type: "uri", value: "https://mixed.test" },
          { type: "dns", value: "mixed.test" },
          { type: "email", value: "ops@mixed.test" },
        ],
        serialNumber: SERIAL,
      });

      const parsed = parseX509Certificate(der);
      expect(parsed.extensions.subjectAltNames).toEqual([
        { type: "uri", value: "https://mixed.test" },
        { type: "dns", value: "mixed.test" },
        { type: "email", value: "ops@mixed.test" },
      ]);

      const peculiar = new x509.X509Certificate(toU8(der));
      const sanExt = peculiar.extensions.find((e) => e.type === "2.5.29.17") as
        | x509.SubjectAlternativeNameExtension
        | undefined;
      expect(sanExt).toBeDefined();
      const names = sanExt!.names.toJSON();
      const types = names.map((n) => n.type);
      expect(types).toEqual(expect.arrayContaining(["url", "dns", "email"]));
    });
  });
});
