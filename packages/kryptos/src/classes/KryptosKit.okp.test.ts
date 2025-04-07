import MockDate from "mockdate";
import {
  TEST_OKP_KEY_B64,
  TEST_OKP_KEY_JWK,
  TEST_OKP_KEY_PEM,
} from "../__fixtures__/okp-keys";
import { KryptosKit } from "./KryptosKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockReturnValue("6e6f84b0-e125-5e3f-90ae-c65269668d98"),
}));

describe("KryptosKit (OKP)", () => {
  describe("clone", () => {
    test("should clone", () => {
      const kryptos = KryptosKit.from.auto(TEST_OKP_KEY_B64);
      const cloned = KryptosKit.clone(kryptos);

      expect(cloned.toJSON()).toEqual(kryptos.toJSON());
      expect(cloned.toJWK()).toEqual(kryptos.toJWK());
      expect(cloned.export("b64")).toEqual(kryptos.export("b64"));
    });
  });

  describe("env", () => {
    test("import", () => {
      const kryptos = KryptosKit.env.import(
        "kryptos:ZmYyYTQ0OGUtOGViMC01OWE4LThmYzYtMGNlMjNhZDA3ZThmLkVkRFNBLkVkMjU1MTkuLnNpZ24sdmVyaWZ5Lk1DNENBUUF3QlFZREsyVndCQ0lFSUJ3S0psdm9oMW5nZDlMUmQ3ZHR2R09TcVc0dVphbWR2SXUwQUJEMkFreEwuTUNvd0JRWURLMlZ3QXlFQUdSQ3dDQTZsQ2hvc0ZHTVF3eEdpSENkemJsZnZDejBGTmlSdFRubTFxcWMuLk9LUC5zaWc",
      );

      expect(kryptos.export("b64")).toEqual(TEST_OKP_KEY_B64);
    });

    test("export", () => {
      const kryptos = KryptosKit.from.auto(TEST_OKP_KEY_B64);

      expect(KryptosKit.env.export(kryptos)).toEqual(
        "kryptos:ZmYyYTQ0OGUtOGViMC01OWE4LThmYzYtMGNlMjNhZDA3ZThmLkVkRFNBLkVkMjU1MTkuLnNpZ24sdmVyaWZ5Lk1DNENBUUF3QlFZREsyVndCQ0lFSUJ3S0psdm9oMW5nZDlMUmQ3ZHR2R09TcVc0dVphbWR2SXUwQUJEMkFreEwuTUNvd0JRWURLMlZ3QXlFQUdSQ3dDQTZsQ2hvc0ZHTVF3eEdpSENkemJsZnZDejBGTmlSdFRubTFxcWMuLk9LUC5zaWc",
      );
    });
  });

  describe("from", () => {
    describe("auto", () => {
      test("b64", () => {
        const kryptos = KryptosKit.from.auto(TEST_OKP_KEY_B64);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("b64")).toMatchSnapshot();
      });

      test("jwk", () => {
        const kryptos = KryptosKit.from.auto(TEST_OKP_KEY_JWK);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("jwk")).toMatchSnapshot();
      });

      test("pem", () => {
        const kryptos = KryptosKit.from.auto(TEST_OKP_KEY_PEM);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("pem")).toMatchSnapshot();
      });
    });

    test("b64", () => {
      const kryptos = KryptosKit.from.b64(TEST_OKP_KEY_B64);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("b64")).toMatchSnapshot();
    });

    test("jwk", () => {
      const kryptos = KryptosKit.from.jwk(TEST_OKP_KEY_JWK);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("jwk")).toMatchSnapshot();
    });

    test("pem", () => {
      const kryptos = KryptosKit.from.pem(TEST_OKP_KEY_PEM);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("pem")).toMatchSnapshot();
    });
  });

  describe("is", () => {
    test("isEc", () => {
      const kryptos = KryptosKit.from.b64(TEST_OKP_KEY_B64);

      expect(KryptosKit.isEc(kryptos)).toBe(false);
    });

    test("isOct", () => {
      const kryptos = KryptosKit.from.b64(TEST_OKP_KEY_B64);

      expect(KryptosKit.isOct(kryptos)).toBe(false);
    });

    test("isOkp", () => {
      const kryptos = KryptosKit.from.b64(TEST_OKP_KEY_B64);

      expect(KryptosKit.isOkp(kryptos)).toBe(true);
    });

    test("isRsa", () => {
      const kryptos = KryptosKit.from.b64(TEST_OKP_KEY_B64);

      expect(KryptosKit.isRsa(kryptos)).toBe(false);
    });
  });

  describe("generate", () => {
    test("auto", () => {
      const kryptos = KryptosKit.generate.auto({
        algorithm: "ECDH-ES+A128GCMKW",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "ECDH-ES+A128GCMKW",
        curve: "P-256",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
        use: "enc",
      });
    });

    test("enc", () => {
      const kryptos = KryptosKit.generate.enc.okp({
        algorithm: "ECDH-ES",
        encryption: "A256GCM",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "ECDH-ES",
        curve: "X25519",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
        use: "enc",
      });
    });

    test("sig", () => {
      const kryptos = KryptosKit.generate.sig.okp({
        algorithm: "EdDSA",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "EdDSA",
        curve: "Ed448",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
        use: "sig",
      });
    });
  });
});
