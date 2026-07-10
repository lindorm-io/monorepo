import { describe, expect, test } from "vitest";
import type { IKryptos } from "../interfaces/index.js";
import { describeCertificate } from "../internal/utils/x509/describe-certificate.js";
import { parseX509Certificate } from "../internal/utils/x509/parse-certificate.js";
import { KryptosKit } from "./index.js";

const NB = new Date("2026-01-01T00:00:00Z");
const ROOT_EXP = new Date("2046-01-01T00:00:00Z");
const INT_EXP = new Date("2040-01-01T00:00:00Z");
const LEAF_EXP = new Date("2036-01-01T00:00:00Z");

const rootCa = (pathLengthConstraint?: number): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "ES384",
    notBefore: NB,
    expiresAt: ROOT_EXP,
    certificate: {
      mode: "root-ca",
      subject: "Lindorm Root CA",
      organization: "Lindorm",
      ...(pathLengthConstraint !== undefined ? { pathLengthConstraint } : {}),
    },
  });

const parsedLeaf = (key: IKryptos) =>
  parseX509Certificate(Buffer.from(key.certificateChain[0], "base64"));

describe("intermediate-CA certificates", () => {
  test("mints a three-tier root → intermediate → leaf chain that verifies", () => {
    const root = rootCa(1);
    const intermediate = KryptosKit.generate.auto({
      algorithm: "ES256",
      notBefore: NB,
      expiresAt: INT_EXP,
      certificate: {
        mode: "intermediate-ca",
        ca: root,
        subject: "Tyr Issuing CA",
        organization: "Lindorm",
        pathLengthConstraint: 0,
      },
    });
    const leaf = KryptosKit.generate.auto({
      algorithm: "ES256",
      notBefore: NB,
      expiresAt: LEAF_EXP,
      certificate: { mode: "ca-signed", ca: intermediate, subject: "tyr.lindorm.io" },
    });

    expect(intermediate.certificateChain).toHaveLength(2);
    expect(leaf.certificateChain).toHaveLength(3);

    // Verifies against the root anchor.
    expect(() =>
      leaf.verifyCertificate({ trustAnchors: root.certificateChain[0] }),
    ).not.toThrow();

    // The intermediate is a CA with pathLen=0, critical basicConstraints, and
    // keyCertSign|cRLSign critical (RFC 5280 §4.2.1.9 / §4.2.1.3).
    const intCert = parsedLeaf(intermediate);
    expect(intCert.extensions.basicConstraintsCa).toBe(true);
    expect(intCert.extensions.basicConstraintsPathLen).toBe(0);
    expect(intCert.extensions.basicConstraintsCritical).toBe(true);
    expect(intCert.extensions.keyUsageCritical).toBe(true);
    expect(intCert.extensions.keyUsage).toContain("keyCertSign");
    expect(intCert.extensions.keyUsage).toContain("crlSign");

    // describe surfaces the same for inspect.
    const described = describeCertificate(intermediate.certificateChain[0]);
    expect(described.basicConstraints).toMatchObject({
      ca: true,
      pathLenConstraint: 0,
      critical: true,
    });
    expect(described.keyUsageCritical).toBe(true);
  });

  test("an intermediate inherits the CA's validity window when dates are omitted", () => {
    const root = rootCa(1);
    const intermediate = KryptosKit.generate.auto({
      algorithm: "ES256",
      certificate: { mode: "intermediate-ca", ca: root, subject: "Int" },
    });

    // No notBefore/expiresAt supplied → inherits the root's window (so the
    // natural "generate root, generate intermediate" idiom does not throw).
    expect(intermediate.notBefore.getTime()).toBe(root.notBefore.getTime());
    expect(intermediate.expiresAt.getTime()).toBe(root.expiresAt.getTime());
    expect(intermediate.certificateChain).toHaveLength(2);
  });

  describe("mint-time path-length guards (RFC 5280 §4.2.1.9)", () => {
    test("refuses an intermediate under a pathLen=0 issuer", () => {
      const root = rootCa(1);
      const intermediate = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: INT_EXP,
        certificate: {
          mode: "intermediate-ca",
          ca: root,
          subject: "Int",
          pathLengthConstraint: 0,
        },
      });

      expect(() =>
        KryptosKit.generate.auto({
          algorithm: "ES256",
          notBefore: NB,
          expiresAt: LEAF_EXP,
          certificate: { mode: "intermediate-ca", ca: intermediate, subject: "Sub" },
        }),
      ).toThrow(/only issue end-entity|pathLenConstraint=0/i);
    });

    test("refuses a child pathLen >= the issuer's pathLen", () => {
      const root = rootCa(1);

      expect(() =>
        KryptosKit.generate.auto({
          algorithm: "ES256",
          notBefore: NB,
          expiresAt: INT_EXP,
          certificate: {
            mode: "intermediate-ca",
            ca: root,
            subject: "Int",
            pathLengthConstraint: 1,
          },
        }),
      ).toThrow(/strictly less than/i);
    });

    test("allows a child pathLen when the issuer has no pathLen", () => {
      const root = rootCa(); // unconstrained
      const intermediate = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: INT_EXP,
        certificate: {
          mode: "intermediate-ca",
          ca: root,
          subject: "Int",
          pathLengthConstraint: 3,
        },
      });

      expect(parsedLeaf(intermediate).extensions.basicConstraintsPathLen).toBe(3);
    });
  });

  test("end-entity certs never carry a pathLenConstraint (RFC 5280 §4.2.1.9)", () => {
    const root = rootCa(1);
    const selfSigned = KryptosKit.generate.auto({
      algorithm: "ES256",
      certificate: { mode: "self-signed", subject: "leaf" },
    });
    const caSigned = KryptosKit.generate.auto({
      algorithm: "ES256",
      notBefore: NB,
      expiresAt: LEAF_EXP,
      certificate: { mode: "ca-signed", ca: root, subject: "leaf" },
    });

    for (const key of [selfSigned, caSigned]) {
      const cert = parsedLeaf(key);
      expect(cert.extensions.basicConstraintsCa).toBe(false);
      expect(cert.extensions.basicConstraintsPathLen).toBeUndefined();
      // Criticality audit: the encoder marks basicConstraints (§4.2.1.9) and
      // keyUsage (§4.2.1.3 SHOULD) critical on all certs, including end-entity.
      expect(cert.extensions.basicConstraintsCritical).toBe(true);
      expect(cert.extensions.keyUsageCritical).toBe(true);
    }
  });

  test("an end-entity cannot be used to sign a certificate (mint-time)", () => {
    const root = rootCa(1);
    const leaf = KryptosKit.generate.auto({
      algorithm: "ES256",
      notBefore: NB,
      expiresAt: LEAF_EXP,
      certificate: { mode: "ca-signed", ca: root, subject: "leaf" },
    });

    expect(() =>
      KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: LEAF_EXP,
        certificate: { mode: "ca-signed", ca: leaf, subject: "grandchild" },
      }),
    ).toThrow(/cA=true/i);
  });

  describe("SAN policy per mode (RFC 5280 §4.2.1.6)", () => {
    test("CA certs (root-ca, intermediate-ca) default to no SAN", () => {
      const root = rootCa(1);
      const intermediate = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: INT_EXP,
        issuer: "https://tyr.test",
        certificate: { mode: "intermediate-ca", ca: root, subject: "Int" },
      });

      expect(parsedLeaf(root).extensions.subjectAltNames).toEqual([]);
      expect(parsedLeaf(intermediate).extensions.subjectAltNames).toEqual([]);
    });

    test("end-entity with an issuer defaults to a URI SAN of the issuer", () => {
      const key = KryptosKit.generate.auto({
        algorithm: "ES256",
        issuer: "https://tyr.test",
        certificate: { mode: "self-signed", subject: "leaf" },
      });

      expect(parsedLeaf(key).extensions.subjectAltNames).toEqual([
        { type: "uri", value: "https://tyr.test" },
      ]);
    });

    test("end-entity without an issuer defaults to no SAN", () => {
      const key = KryptosKit.generate.auto({
        algorithm: "ES256",
        certificate: { mode: "self-signed", subject: "leaf" },
      });

      expect(parsedLeaf(key).extensions.subjectAltNames).toEqual([]);
    });

    test("explicit subjectAlternativeNames win in every mode", () => {
      const root = rootCa(1);
      const explicitCa = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: INT_EXP,
        certificate: {
          mode: "intermediate-ca",
          ca: root,
          subject: "Int",
          subjectAlternativeNames: [{ type: "dns", value: "ca.tyr.test" }],
        },
      });

      expect(parsedLeaf(explicitCa).extensions.subjectAltNames).toEqual([
        { type: "dns", value: "ca.tyr.test" },
      ]);
    });
  });
});
