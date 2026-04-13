import { createPublicKey, verify } from "crypto";
import {
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_PEM,
  TEST_X509_ROOT_PEM,
} from "../../../__fixtures__/x509";
import { parseX509Certificate } from "./parse-certificate";
import { parseX509 } from "./parse-x509";

// End-to-end: walk a real chain using only our parser + crypto.verify, with no
// Node X509Certificate involvement on the hot path.
describe("verify-chain direct (DIY parser + crypto.verify)", () => {
  test("leaf -> intermediate -> root signature walk", () => {
    const [leafDer, intermediateDer, rootDer] = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);
    const leaf = parseX509Certificate(leafDer);
    const intermediate = parseX509Certificate(intermediateDer);
    const root = parseX509Certificate(rootDer);

    const intermediateKey = createPublicKey({
      key: intermediate.subjectPublicKeyInfo,
      format: "der",
      type: "spki",
    });
    expect(verify("sha256", leaf.tbsBytes, intermediateKey, leaf.signatureBytes)).toBe(
      true,
    );

    const rootKey = createPublicKey({
      key: root.subjectPublicKeyInfo,
      format: "der",
      type: "spki",
    });
    expect(
      verify("sha256", intermediate.tbsBytes, rootKey, intermediate.signatureBytes),
    ).toBe(true);
  });
});
