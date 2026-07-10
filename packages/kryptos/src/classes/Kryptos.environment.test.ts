import { describe, expect, test } from "vitest";
import type { IKryptos } from "../interfaces/index.js";
import { KryptosKit } from "./index.js";

const NB = new Date("2026-01-01T00:00:00Z");
const ROOT_EXP = new Date("2046-01-01T00:00:00Z");
const LEAF_EXP = new Date("2036-01-01T00:00:00Z");

const ou = (key: IKryptos): string | undefined =>
  key.certificate?.subject.organizationalUnit;

const devRoot = (): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "ES384",
    notBefore: NB,
    expiresAt: ROOT_EXP,
    certificate: {
      mode: "root-ca",
      subject: "Root CA",
      environment: "development",
      pathLengthConstraint: 1,
    },
  });

describe("certificate environment (subject OU)", () => {
  test("stamps the environment as the subject OU for a self-signed leaf", () => {
    const key = KryptosKit.generate.auto({
      algorithm: "ES256",
      certificate: { mode: "self-signed", subject: "leaf", environment: "production" },
    });

    expect(ou(key)).toBe("production");
  });

  test("stamps the environment as the subject OU for a root CA", () => {
    expect(ou(devRoot())).toBe("development");
  });

  test("omits the OU when no environment is given", () => {
    const key = KryptosKit.generate.auto({
      algorithm: "ES256",
      certificate: { mode: "self-signed", subject: "leaf" },
    });

    expect(ou(key)).toBeUndefined();
  });

  describe("inheritance and cross-environment refusal", () => {
    test("a ca-signed child inherits the CA's environment OU", () => {
      const root = devRoot();
      const child = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: LEAF_EXP,
        certificate: { mode: "ca-signed", ca: root, subject: "child" },
      });

      expect(ou(child)).toBe("development");
    });

    test("an intermediate-ca child inherits the CA's environment OU", () => {
      const root = devRoot();
      const intermediate = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: new Date("2040-01-01T00:00:00Z"),
        certificate: {
          mode: "intermediate-ca",
          ca: root,
          subject: "Int",
          pathLengthConstraint: 0,
        },
      });

      expect(ou(intermediate)).toBe("development");
    });

    test("a matching declared environment is allowed", () => {
      const root = devRoot();
      const child = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: LEAF_EXP,
        certificate: {
          mode: "ca-signed",
          ca: root,
          subject: "child",
          environment: "development",
        },
      });

      expect(ou(child)).toBe("development");
    });

    test("a differing declared environment is refused (dev/prod never mix)", () => {
      const root = devRoot();

      expect(() =>
        KryptosKit.generate.auto({
          algorithm: "ES256",
          notBefore: NB,
          expiresAt: LEAF_EXP,
          certificate: {
            mode: "ca-signed",
            ca: root,
            subject: "child",
            environment: "production",
          },
        }),
      ).toThrow(/cross-environment/i);
    });

    test("a CA without an environment OU imposes no constraint", () => {
      const root = KryptosKit.generate.auto({
        algorithm: "ES384",
        notBefore: NB,
        expiresAt: ROOT_EXP,
        certificate: { mode: "root-ca", subject: "Root CA", pathLengthConstraint: 1 },
      });

      const child = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: LEAF_EXP,
        certificate: {
          mode: "ca-signed",
          ca: root,
          subject: "child",
          environment: "staging",
        },
      });

      expect(ou(root)).toBeUndefined();
      expect(ou(child)).toBe("staging");
    });
  });
});
