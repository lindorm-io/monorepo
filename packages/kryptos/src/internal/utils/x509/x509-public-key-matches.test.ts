import {
  TEST_X509_LEAF_PEM,
  TEST_X509_LEAF_PUBLIC_KEY_B64,
  TEST_X509_OTHER_PUBLIC_KEY_B64,
} from "../../../__fixtures__/x509";
import { extractLeafSpki } from "./extract-leaf-spki";
import { parseX509 } from "./parse-x509";
import { x509PublicKeyMatches } from "./x509-public-key-matches";

describe("x509PublicKeyMatches", () => {
  test("returns true when leaf SPKI matches the kryptos EC public key", () => {
    const [leafDer] = parseX509(TEST_X509_LEAF_PEM);
    const spki = extractLeafSpki(leafDer);
    const pubKey = Buffer.from(TEST_X509_LEAF_PUBLIC_KEY_B64, "base64url");

    expect(x509PublicKeyMatches(spki, pubKey, "EC")).toBe(true);
  });

  test("returns false for a mismatched EC key", () => {
    const [leafDer] = parseX509(TEST_X509_LEAF_PEM);
    const spki = extractLeafSpki(leafDer);
    const otherPubKey = Buffer.from(TEST_X509_OTHER_PUBLIC_KEY_B64, "base64url");

    expect(x509PublicKeyMatches(spki, otherPubKey, "EC")).toBe(false);
  });
});
