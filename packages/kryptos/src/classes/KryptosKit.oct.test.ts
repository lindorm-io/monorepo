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
        "kryptos:ZDhlODMwNzAtYjkwNi01NTQwLTk5MzMtMDFmZTg5MDM3MTY4LkhTNTEyLi4uc2lnbix2ZXJpZnkuZGlZbnljZVp4bW4xOHhHalZvYkJFd09TajJRT2F2SGZ2X3RXR051QnBqTkQ1NzJQYTNxRDhQRHFEU3J2b0x0TE9XeUhkUTVsc21zdUVJRGNQZ2JQS3A5MkhmTmthd2JLcENzVk5CcG9UbGJaLTVqZXdMTVJFb0dqZTlfcFF6R1NQTGdoLWNBa3d0Y3JMVUpOYndieU1HTWxYbUlKWGVHdWtXc0Q2QmZPQWltTnpQSXlMZjhRWU1KWUw5dHpmMTZYNG1RMVN2VTc2WThNcW9wNnd6OHlsQUVUN3hXVGl2SS1pT0s4WmsxTWlpb21Kd3c1dzQ3VXo3WDZIYV91ejdjdENFU3N5WU1lZjlabllsc3F3c0hQcm5QNzhpaHlpdjhjSDdvYnViS0o2SGttc0NuU1RCT2NoRFl4bm1RaVZaZmZ1TVNiOHBTY2FJSzZWZmVmXzFjN1ZnLi4ub2N0LnNpZw",
      );

      expect(kryptos.export("b64")).toEqual(expect.objectContaining(TEST_OCT_KEY_B64));
    });

    test("export", () => {
      const kryptos = KryptosKit.from.auto(TEST_OCT_KEY_B64);

      expect(KryptosKit.env.export(kryptos)).toEqual(
        "kryptos:ZDhlODMwNzAtYjkwNi01NTQwLTk5MzMtMDFmZTg5MDM3MTY4LkhTNTEyLi4uc2lnbix2ZXJpZnkuZGlZbnljZVp4bW4xOHhHalZvYkJFd09TajJRT2F2SGZ2X3RXR051QnBqTkQ1NzJQYTNxRDhQRHFEU3J2b0x0TE9XeUhkUTVsc21zdUVJRGNQZ2JQS3A5MkhmTmthd2JLcENzVk5CcG9UbGJaLTVqZXdMTVJFb0dqZTlfcFF6R1NQTGdoLWNBa3d0Y3JMVUpOYndieU1HTWxYbUlKWGVHdWtXc0Q2QmZPQWltTnpQSXlMZjhRWU1KWUw5dHpmMTZYNG1RMVN2VTc2WThNcW9wNnd6OHlsQUVUN3hXVGl2SS1pT0s4WmsxTWlpb21Kd3c1dzQ3VXo3WDZIYV91ejdjdENFU3N5WU1lZjlabllsc3F3c0hQcm5QNzhpaHlpdjhjSDdvYnViS0o2SGttc0NuU1RCT2NoRFl4bm1RaVZaZmZ1TVNiOHBTY2FJSzZWZmVmXzFjN1ZnLi4ub2N0LnNpZw",
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

  describe("generate", () => {
    test("auto", () => {
      const kryptos = KryptosKit.generate.auto({
        algorithm: "HS384",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "HS384",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "sig",
      });
    });

    test("enc", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "dir",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "enc",
      });
    });

    test("sig", () => {
      const kryptos = KryptosKit.generate.sig.oct({
        algorithm: "HS512",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "HS512",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "sig",
      });
    });
  });
});
