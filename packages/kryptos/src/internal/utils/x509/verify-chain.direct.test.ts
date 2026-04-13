import { createPublicKey, verify } from "crypto";
import {
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_PEM,
  TEST_X509_ROOT_PEM,
} from "../../../__fixtures__/x509";
import { parseX509 } from "./parse-x509";

// End-to-end: walk a real chain using only our parser + crypto.verify, with no
// Node X509Certificate involvement on the hot path.
describe("verify-chain direct (DIY parser + crypto.verify)", () => {
  test("leaf -> intermediate -> root signature walk", () => {
    const [leaf, intermediate, root] = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);

    const intermediateKey = createPublicKey({
      key: intermediate.cert.subjectPublicKeyInfo,
      format: "der",
      type: "spki",
    });
    expect(
      verify("sha256", leaf.cert.tbsBytes, intermediateKey, leaf.cert.signatureBytes),
    ).toBe(true);

    const rootKey = createPublicKey({
      key: root.cert.subjectPublicKeyInfo,
      format: "der",
      type: "spki",
    });
    expect(
      verify(
        "sha256",
        intermediate.cert.tbsBytes,
        rootKey,
        intermediate.cert.signatureBytes,
      ),
    ).toBe(true);
  });
});
