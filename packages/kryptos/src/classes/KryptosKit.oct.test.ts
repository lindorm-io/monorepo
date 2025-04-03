import MockDate from "mockdate";
import {
  TEST_OCT_KEY_B64,
  TEST_OCT_KEY_JWK,
  TEST_OCT_KEY_PEM,
  TEST_OCT_KEY_UTF,
} from "../__fixtures__/oct-keys";
import { KryptosKit } from "./KryptosKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockReturnValue("6e6f84b0-e125-5e3f-90ae-c65269668d98"),
}));

describe("KryptosKit (oct)", () => {
  describe("clone", () => {
    test("should clone", () => {
      const kryptos = KryptosKit.from.auto(TEST_OCT_KEY_B64);
      const cloned = KryptosKit.clone(kryptos);

      expect(cloned.toJSON()).toEqual(kryptos.toJSON());
      expect(cloned.toJWK()).toEqual(kryptos.toJWK());
      expect(cloned.export("b64")).toEqual(kryptos.export("b64"));
    });
  });

  describe("env", () => {
    test("import", () => {
      const kryptos = KryptosKit.env.import(
        "kryptos:6e6f84b0-e125-5e3f-90ae-c65269668d98.HS512....diYnyceZxmn18xGjVobBEwOSj2QOavHfv_tWGNuBpjND572Pa3qD8PDqDSrvoLtLOWyHdQ5lsmsuEIDcPgbPKp92HfNkawbKpCsVNBpoTlbZ-5jewLMREoGje9_pQzGSPLgh-cAkwtcrLUJNbwbyMGMlXmIJXeGukWsD6BfOAimNzPIyLf8QYMJYL9tzf16X4mQ1SvU76Y8Mqop6wz8ylAET7xWTivI-iOK8Zk1MiiomJww5w47Uz7X6Ha_uz7ctCESsyYMef9ZnYlsqwsHPrnP78ihyiv8cH7obubKJ6HkmsCnSTBOchDYxnmQiVZffuMSb8pScaIK6Vfef_1c7Vg...oct.sig",
      );

      expect(kryptos.export("b64")).toEqual(expect.objectContaining(TEST_OCT_KEY_B64));
    });

    test("export", () => {
      const kryptos = KryptosKit.from.auto(TEST_OCT_KEY_B64);

      expect(KryptosKit.env.export(kryptos)).toEqual(
        "kryptos:6e6f84b0-e125-5e3f-90ae-c65269668d98.HS512....diYnyceZxmn18xGjVobBEwOSj2QOavHfv_tWGNuBpjND572Pa3qD8PDqDSrvoLtLOWyHdQ5lsmsuEIDcPgbPKp92HfNkawbKpCsVNBpoTlbZ-5jewLMREoGje9_pQzGSPLgh-cAkwtcrLUJNbwbyMGMlXmIJXeGukWsD6BfOAimNzPIyLf8QYMJYL9tzf16X4mQ1SvU76Y8Mqop6wz8ylAET7xWTivI-iOK8Zk1MiiomJww5w47Uz7X6Ha_uz7ctCESsyYMef9ZnYlsqwsHPrnP78ihyiv8cH7obubKJ6HkmsCnSTBOchDYxnmQiVZffuMSb8pScaIK6Vfef_1c7Vg...oct.sig",
      );
    });
  });

  describe("from", () => {
    describe("auto", () => {
      test("b64", () => {
        const kryptos = KryptosKit.from.auto(TEST_OCT_KEY_B64);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("b64")).toMatchSnapshot();
      });

      test("jwk", () => {
        const kryptos = KryptosKit.from.auto(TEST_OCT_KEY_JWK);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("jwk")).toMatchSnapshot();
      });

      test("pem", () => {
        const kryptos = KryptosKit.from.auto(TEST_OCT_KEY_PEM);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("pem")).toMatchSnapshot();
      });
    });

    test("b64", () => {
      const kryptos = KryptosKit.from.b64(TEST_OCT_KEY_B64);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("b64")).toMatchSnapshot();
    });

    test("jwk", () => {
      const kryptos = KryptosKit.from.jwk(TEST_OCT_KEY_JWK);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("jwk")).toMatchSnapshot();
    });

    test("pem", () => {
      const kryptos = KryptosKit.from.pem(TEST_OCT_KEY_PEM);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("pem")).toMatchSnapshot();
    });

    test("utf", () => {
      const kryptos = KryptosKit.from.utf(TEST_OCT_KEY_UTF);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("b64")).toMatchSnapshot();
    });
  });

  describe("is", () => {
    test("isEc", () => {
      const kryptos = KryptosKit.from.b64(TEST_OCT_KEY_B64);

      expect(KryptosKit.isEc(kryptos)).toBe(false);
    });

    test("isOct", () => {
      const kryptos = KryptosKit.from.b64(TEST_OCT_KEY_B64);

      expect(KryptosKit.isOct(kryptos)).toBe(true);
    });

    test("isOkp", () => {
      const kryptos = KryptosKit.from.b64(TEST_OCT_KEY_B64);

      expect(KryptosKit.isOkp(kryptos)).toBe(false);
    });

    test("isRsa", () => {
      const kryptos = KryptosKit.from.b64(TEST_OCT_KEY_B64);

      expect(KryptosKit.isRsa(kryptos)).toBe(false);
    });
  });

  describe("make", () => {
    test("auto", () => {
      const kryptos = KryptosKit.make.auto({
        algorithm: "HS384",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        algorithm: "HS384",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "sig",
      });
    });

    test("enc", () => {
      const kryptos = KryptosKit.make.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        algorithm: "dir",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "enc",
      });
    });

    test("sig", () => {
      const kryptos = KryptosKit.make.sig.oct({
        algorithm: "HS512",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "sig",
      });
    });
  });
});
