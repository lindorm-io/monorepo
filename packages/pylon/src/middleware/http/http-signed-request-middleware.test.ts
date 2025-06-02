import { SignatureKit } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger";
import { ShaError, ShaKit } from "@lindorm/sha";
import MockDate from "mockdate";
import { EcError } from "../../../../ec/dist";
import { createHttpSignedRequestMiddleware } from "./http-signed-request-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

describe("httpSignedRequestMiddleware", () => {
  let ctx: any;
  let date: any;
  let kryptos: any;
  let headers: any;
  let digest: any;
  let signature: any;
  let callback: any;

  beforeEach(() => {
    kryptos = KryptosKit.from.b64({
      id: "5d17c551-7b6f-474a-8679-dba9bbfa06a2",
      algorithm: "ES256",
      curve: "P-256",
      privateKey:
        "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcyOxjn7CekTvSkiQvqx5JhFOmwPYFVFHmLKfio6aJ1uhRANCAAQfFaJkGZMxDn656YiDrSJ5sLRwip-y3a0VzC4cUPxxAJzuRBRtVqM3GitfTQEiUrzF2pcmMZbteAOhIqLlU_f6",
      publicKey:
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHxWiZBmTMQ5-uemIg60iebC0cIqfst2tFcwuHFD8cQCc7kQUbVajNxorX00BIlK8xdqXJjGW7XgDoSKi5VP3-g",
      purpose: "token",
      type: "EC",
      use: "sig",
    });

    callback = jest.fn().mockResolvedValue(kryptos);

    const shaKit = new ShaKit({
      algorithm: "SHA384",
      encoding: "base64url",
    });

    const signatureKit = new SignatureKit({
      dsa: "der",
      encoding: "base64url",
      kryptos,
    });

    const body = {
      foo: "bar",
      baz: 42,
      random: "l9065hpUGzFsspO1",
    };

    date = MockedDate.toUTCString();

    const bodyHash = shaKit.hash(JSON.stringify(body));

    digest = [`algorithm="SHA384"`, `encoding="base64url"`, `hash="${bodyHash}"`].join(
      "; ",
    );

    headers = {
      date,
      digest,
      "x-test-one": "one",
      "x-test-two": "two",
      "x-test-three": "three",
    };

    const headersHash = signatureKit.format(signatureKit.sign(JSON.stringify(headers)));

    signature = [
      `dsa="der"`,
      `encoding="base64url"`,
      `hash="${headersHash}"`,
      `headers="${Object.keys(headers).join(",")}"`,
      `key="${kryptos.id}"`,
    ].join("; ");

    ctx = {
      logger: createMockLogger(),
      request: { body },
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case "date":
            return date;
          case "digest":
            return digest;
          case "signature":
            return signature;
          case "x-test-one":
            return "one";
          case "x-test-two":
            return "two";
          case "x-test-three":
            return "three";
          default:
            return undefined;
        }
      }),
    };
  });

  test("should validate signed request", async () => {
    await expect(
      createHttpSignedRequestMiddleware(callback)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("should resolve without signature", async () => {
    signature = undefined;

    await expect(
      createHttpSignedRequestMiddleware(callback)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(callback).not.toHaveBeenCalled();
  });

  test("should throw on missing required signature", async () => {
    signature = undefined;

    await expect(
      createHttpSignedRequestMiddleware(callback, { required: true })(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });

  test("should throw on missing date", async () => {
    date = undefined;

    await expect(
      createHttpSignedRequestMiddleware(callback, { required: true })(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });

  test("should throw on missing digest", async () => {
    digest = undefined;

    await expect(
      createHttpSignedRequestMiddleware(callback, { required: true })(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });

  test("should throw on invalid digest", async () => {
    digest = [`algorithm="SHA384"`, `encoding="base64url"`, `hash="cQMSq2ds7q8QX"`].join(
      ";",
    );

    await expect(
      createHttpSignedRequestMiddleware(callback, { required: true })(ctx, jest.fn()),
    ).rejects.toThrow(ShaError);
  });

  test("should throw on invalid signature", async () => {
    signature = [
      `dsa="der"`,
      `encoding="base64url"`,
      `hash="SMANq723e0JyyDg1WjMolSpwJy"`,
      `headers="${Object.keys(headers).join(",")}"`,
      `key="${kryptos.id}"`,
    ].join(";");

    await expect(
      createHttpSignedRequestMiddleware(callback, { required: true })(ctx, jest.fn()),
    ).rejects.toThrow(EcError);
  });
});
