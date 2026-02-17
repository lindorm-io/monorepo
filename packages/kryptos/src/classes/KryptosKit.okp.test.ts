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
        "kryptos:eyJpYXQiOjE3MDQwOTYwMDAsImtleV9vcHMiOlsic2lnbiIsInZlcmlmeSJdLCJuYmYiOjE3MDQwOTYwMDAsInVhdCI6MTcwNDA5NjAwMCwiY3J2IjoiRWQyNTUxOSIsIngiOiJHUkN3Q0E2bENob3NGR01Rd3hHaUhDZHpibGZ2Q3owRk5pUnRUbm0xcXFjIiwiZCI6IkhBb21XLWlIV2VCMzB0RjN0MjI4WTVLcGJpNWxxWjI4aTdRQUVQWUNURXMiLCJraWQiOiJmZjJhNDQ4ZS04ZWIwLTU5YTgtOGZjNi0wY2UyM2FkMDdlOGYiLCJhbGciOiJFZERTQSIsInVzZSI6InNpZyIsImt0eSI6Ik9LUCJ9",
      );

      expect(kryptos.export("b64")).toEqual(TEST_OKP_KEY_B64);
    });

    test("export", () => {
      const kryptos = KryptosKit.from.auto(TEST_OKP_KEY_B64);

      expect(KryptosKit.env.export(kryptos)).toEqual(
        "kryptos:eyJjcnYiOiJFZDI1NTE5IiwieCI6IkdSQ3dDQTZsQ2hvc0ZHTVF3eEdpSENkemJsZnZDejBGTmlSdFRubTFxcWMiLCJkIjoiSEFvbVctaUhXZUIzMHRGM3QyMjhZNUtwYmk1bHFaMjhpN1FBRVBZQ1RFcyIsImtpZCI6ImZmMmE0NDhlLThlYjAtNTlhOC04ZmM2LTBjZTIzYWQwN2U4ZiIsImFsZyI6IkVkRFNBIiwidXNlIjoic2lnIiwia3R5IjoiT0tQIiwiaWF0IjoxNzA0MDk2MDAwLCJrZXlfb3BzIjpbInNpZ24iLCJ2ZXJpZnkiXSwibmJmIjoxNzA0MDk2MDAwLCJ1YXQiOjE3MDQwOTYwMDB9",
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
        encryption: "A256GCM",
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
        encryption: "A256GCM",
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
        curve: "Ed25519",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
        use: "sig",
      });
    });
  });
});
