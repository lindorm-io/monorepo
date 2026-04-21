import {
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_B64_DER,
  TEST_X509_LEAF_PEM,
  TEST_X509_ROOT_PEM,
} from "../../../__fixtures__/x509";
import { extractLeafSpki } from "./extract-leaf-spki";
import { parseX509Certificate } from "./parse-certificate";
import { parseX509 } from "./parse-x509";
import { describe, expect, test } from "vitest";

describe("extractLeafSpki", () => {
  test("matches parseX509Certificate subjectPublicKeyInfo for a leaf cert", () => {
    const [leafDer] = parseX509(TEST_X509_LEAF_PEM);
    const spki = extractLeafSpki(leafDer);
    const full = parseX509Certificate(leafDer);

    expect(spki.equals(full.subjectPublicKeyInfo)).toBe(true);
  });

  test("matches parseX509Certificate for base64-DER leaf", () => {
    const [leafDer] = parseX509(TEST_X509_LEAF_B64_DER);
    expect(
      extractLeafSpki(leafDer).equals(parseX509Certificate(leafDer).subjectPublicKeyInfo),
    ).toBe(true);
  });

  test("matches for intermediate and root certs", () => {
    const [intermediateDer] = parseX509(TEST_X509_INTERMEDIATE_PEM);
    const [rootDer] = parseX509(TEST_X509_ROOT_PEM);

    expect(
      extractLeafSpki(intermediateDer).equals(
        parseX509Certificate(intermediateDer).subjectPublicKeyInfo,
      ),
    ).toBe(true);
    expect(
      extractLeafSpki(rootDer).equals(parseX509Certificate(rootDer).subjectPublicKeyInfo),
    ).toBe(true);
  });

  test("throws when input is not a DER SEQUENCE", () => {
    expect(() => extractLeafSpki(Buffer.from([0x02, 0x01, 0x00]))).toThrow(
      /not a SEQUENCE/,
    );
  });

  test("throws on empty input", () => {
    expect(() => extractLeafSpki(Buffer.alloc(0))).toThrow(/invalid DER/);
  });

  test("throws on truncated DER", () => {
    expect(() => extractLeafSpki(Buffer.from([0x30, 0x05, 0x30, 0x03, 0x02]))).toThrow();
  });
});
