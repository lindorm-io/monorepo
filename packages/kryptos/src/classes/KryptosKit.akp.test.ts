import MockDate from "mockdate";
import {
  TEST_AKP_KEY_B64,
  TEST_AKP_KEY_JWK,
  TEST_AKP_KEY_PEM,
} from "../__fixtures__/akp-keys";
import { KryptosKit } from "./KryptosKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockReturnValue("6e6f84b0-e125-5e3f-90ae-c65269668d98"),
}));

describe("KryptosKit (AKP)", () => {
  describe("clone", () => {
    test("should clone", () => {
      const kryptos = KryptosKit.from.auto(TEST_AKP_KEY_B64);
      const cloned = KryptosKit.clone(kryptos);

      expect(cloned.toJSON()).toEqual(kryptos.toJSON());
      expect(cloned.toJWK()).toEqual(kryptos.toJWK());
      expect(cloned.export("b64")).toEqual(kryptos.export("b64"));
    });
  });

  describe("from", () => {
    describe("auto", () => {
      test("b64", () => {
        const kryptos = KryptosKit.from.auto(TEST_AKP_KEY_B64);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("b64")).toMatchSnapshot();
      });

      test("jwk", () => {
        const kryptos = KryptosKit.from.auto(TEST_AKP_KEY_JWK);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("jwk")).toMatchSnapshot();
      });

      test("pem", () => {
        const kryptos = KryptosKit.from.auto(TEST_AKP_KEY_PEM);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("pem")).toMatchSnapshot();
      });
    });

    test("b64", () => {
      const kryptos = KryptosKit.from.b64(TEST_AKP_KEY_B64);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("b64")).toMatchSnapshot();
    });

    test("jwk", () => {
      const kryptos = KryptosKit.from.jwk(TEST_AKP_KEY_JWK);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("jwk")).toMatchSnapshot();
    });

    test("pem", () => {
      const kryptos = KryptosKit.from.pem(TEST_AKP_KEY_PEM);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("pem")).toMatchSnapshot();
    });
  });

  describe("is", () => {
    test("isAkp", () => {
      const kryptos = KryptosKit.from.b64(TEST_AKP_KEY_B64);

      expect(KryptosKit.isAkp(kryptos)).toBe(true);
    });

    test("isEc", () => {
      const kryptos = KryptosKit.from.b64(TEST_AKP_KEY_B64);

      expect(KryptosKit.isEc(kryptos)).toBe(false);
    });

    test("isOct", () => {
      const kryptos = KryptosKit.from.b64(TEST_AKP_KEY_B64);

      expect(KryptosKit.isOct(kryptos)).toBe(false);
    });

    test("isOkp", () => {
      const kryptos = KryptosKit.from.b64(TEST_AKP_KEY_B64);

      expect(KryptosKit.isOkp(kryptos)).toBe(false);
    });

    test("isRsa", () => {
      const kryptos = KryptosKit.from.b64(TEST_AKP_KEY_B64);

      expect(KryptosKit.isRsa(kryptos)).toBe(false);
    });
  });

  describe("generate", () => {
    test("auto", () => {
      const kryptos = KryptosKit.generate.auto({
        algorithm: "ML-DSA-65",
      });

      expect(kryptos.toJSON()).toMatchSnapshot({ thumbprint: expect.any(String) });
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "ML-DSA-65",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "AKP",
        use: "sig",
      });
    });

    test("sig ML-DSA-44", () => {
      const kryptos = KryptosKit.generate.sig.akp({
        algorithm: "ML-DSA-44",
      });

      expect(kryptos.toJSON()).toMatchSnapshot({ thumbprint: expect.any(String) });
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "ML-DSA-44",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "AKP",
        use: "sig",
      });
    });

    test("sig ML-DSA-65", () => {
      const kryptos = KryptosKit.generate.sig.akp({
        algorithm: "ML-DSA-65",
      });

      expect(kryptos.toJSON()).toMatchSnapshot({ thumbprint: expect.any(String) });
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "ML-DSA-65",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "AKP",
        use: "sig",
      });
    });

    test("sig ML-DSA-87", () => {
      const kryptos = KryptosKit.generate.sig.akp({
        algorithm: "ML-DSA-87",
      });

      expect(kryptos.toJSON()).toMatchSnapshot({ thumbprint: expect.any(String) });
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "ML-DSA-87",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "AKP",
        use: "sig",
      });
    });
  });

  describe("generateAsync", () => {
    test("sig", async () => {
      const kryptos = await KryptosKit.generateAsync.sig.akp({
        algorithm: "ML-DSA-65",
      });

      expect(kryptos.algorithm).toEqual("ML-DSA-65");
      expect(kryptos.type).toEqual("AKP");
      expect(kryptos.use).toEqual("sig");
    });
  });
});
