import { describe, expect, test } from "vitest";
import {
  X509_OID_ECDSA_WITH_SHA256,
  X509_OID_ECDSA_WITH_SHA384,
  X509_OID_ECDSA_WITH_SHA512,
  X509_OID_ED25519,
  X509_OID_ED448,
  X509_OID_ML_DSA_44,
  X509_OID_ML_DSA_65,
  X509_OID_ML_DSA_87,
  X509_OID_SHA256_WITH_RSA,
  X509_OID_SHA384_WITH_RSA,
  X509_OID_SHA512_WITH_RSA,
} from "./oids.js";
import { signAlgorithmName } from "./sign-algorithm-name.js";

describe("signAlgorithmName", () => {
  test("should resolve every known signature oid", () => {
    expect(
      Object.fromEntries(
        [
          X509_OID_ECDSA_WITH_SHA256,
          X509_OID_ECDSA_WITH_SHA384,
          X509_OID_ECDSA_WITH_SHA512,
          X509_OID_ED25519,
          X509_OID_ED448,
          X509_OID_ML_DSA_44,
          X509_OID_ML_DSA_65,
          X509_OID_ML_DSA_87,
          X509_OID_SHA256_WITH_RSA,
          X509_OID_SHA384_WITH_RSA,
          X509_OID_SHA512_WITH_RSA,
        ].map((oid) => [oid, signAlgorithmName(oid)]),
      ),
    ).toMatchSnapshot();
  });

  test("should pass an unknown oid through verbatim", () => {
    expect(signAlgorithmName("1.2.3.4.5")).toBe("1.2.3.4.5");
  });
});
