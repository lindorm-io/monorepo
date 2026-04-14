import { TEST_X509_LEAF_PEM } from "../../../__fixtures__/x509";
import { parseX509 } from "./parse-x509";
import { x5tS256 } from "./x509-thumbprints";

describe("x509-thumbprints", () => {
  const [leaf] = parseX509(TEST_X509_LEAF_PEM);

  test("x5tS256 returns base64url SHA-256 of leaf DER", () => {
    expect(x5tS256(leaf)).toMatchSnapshot();
  });
});
