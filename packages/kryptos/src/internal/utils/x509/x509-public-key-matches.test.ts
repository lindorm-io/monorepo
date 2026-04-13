import { createPublicKey } from "crypto";
import {
  TEST_X509_LEAF_PEM,
  TEST_X509_OTHER_PUBLIC_KEY_B64,
} from "../../../__fixtures__/x509";
import { parseX509 } from "./parse-x509";
import { x509PublicKeyMatches } from "./x509-public-key-matches";

describe("x509PublicKeyMatches", () => {
  test("returns true when leaf cert matches the kryptos EC public key", () => {
    const [leaf] = parseX509(TEST_X509_LEAF_PEM);

    expect(x509PublicKeyMatches(leaf.cert, leaf.cert.subjectPublicKeyInfo, "EC")).toBe(
      true,
    );
  });

  test("returns false for a mismatched EC key", () => {
    const [leaf] = parseX509(TEST_X509_LEAF_PEM);
    const otherSpki = createPublicKey({
      key: Buffer.from(TEST_X509_OTHER_PUBLIC_KEY_B64, "base64url"),
      format: "der",
      type: "spki",
    }).export({ format: "der", type: "spki" }) as Buffer;

    expect(x509PublicKeyMatches(leaf.cert, otherSpki, "EC")).toBe(false);
  });
});
