import {
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_B64_DER,
  TEST_X509_LEAF_PEM,
  TEST_X509_ROOT_PEM,
} from "../../../__fixtures__/x509";
import { parseX509 } from "./parse-x509";

describe("parseX509", () => {
  test("parses a single PEM cert into a DER buffer", () => {
    const result = parseX509(TEST_X509_LEAF_PEM);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Buffer);
  });

  test("parses a base64-DER cert (no PEM wrapper)", () => {
    const result = parseX509(TEST_X509_LEAF_B64_DER);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Buffer);
  });

  test("parses an array of PEM certs (one cert per element)", () => {
    const result = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);

    expect(result).toHaveLength(3);
    result.forEach((der) => expect(der).toBeInstanceOf(Buffer));
  });

  test("parses concatenated PEM blocks in a single string", () => {
    const concatenated =
      TEST_X509_LEAF_PEM + "\n" + TEST_X509_INTERMEDIATE_PEM + "\n" + TEST_X509_ROOT_PEM;
    const result = parseX509(concatenated);

    expect(result).toHaveLength(3);
  });

  test("throws for empty input array", () => {
    expect(() => parseX509([])).toThrow(
      "certificateChain must contain at least one certificate",
    );
  });

  test("throws for empty string entry", () => {
    expect(() => parseX509("")).toThrow();
  });

  test("throws for non-base64, non-PEM input", () => {
    expect(() => parseX509("not a cert!!")).toThrow();
  });
});
