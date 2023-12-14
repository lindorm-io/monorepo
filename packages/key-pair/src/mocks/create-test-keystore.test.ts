import { Keystore } from "../classes";
import { createTestKeystore } from "./create-test-keystore";

describe("createTestKeystore", () => {
  let keystore: Keystore;

  beforeAll(() => {
    keystore = createTestKeystore();
  });

  test("should match snapshot", () => {
    expect(keystore).toMatchSnapshot();
  });

  test("should use default signing key", () => {
    expect(keystore.getSigningKey()).toMatchSnapshot();
  });
});
