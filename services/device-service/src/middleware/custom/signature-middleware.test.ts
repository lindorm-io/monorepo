import { createShaHash } from "@lindorm-io/crypto";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { RsaAlgorithm, RsaFormat, createRsaSignature } from "@lindorm-io/rsa";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { PublicKey } from "../../entity";
import { createTestPublicKey } from "../../fixtures/entity";
import { RSA_KEY_SET } from "../../fixtures/integration/rsa-keys.fixture";
import {
  destructHeaderDigest as _destructHeaderDigest,
  destructHeaderSignature as _destructHeaderSignature,
} from "../../util";
import { signatureMiddleware } from "./signature-middleware";

jest.mock("../../util");

MockDate.set("2023-01-01T08:00:00.000Z");

const destructHeaderDigest = _destructHeaderDigest as jest.Mock;
const destructHeaderSignature = _destructHeaderSignature as jest.Mock;

describe("signatureMiddleware", () => {
  let ctx: any;
  let digest: string;
  let signature: string;
  let next: () => Promise<void>;

  beforeEach(() => {
    const body = {
      foo: "bar",
      bar: "baz",
      random: "TNUakzVKuuVNeESg",
    };

    const bodyHash = createShaHash({
      algorithm: "SHA512",
      data: JSON.stringify(body),
      format: "base64",
    });

    digest = [`algorithm="SHA512"`, `format="base64"`, `hash="${bodyHash}"`].join(",");

    const headers = {
      date: new Date().toUTCString(),
      digest,
      "x-device-installation-id": "a185818a-d759-4741-bdb2-7c1d3526ff1d",
      "x-device-link-id": "76db1d22-fd02-4b59-8d30-d8b403e939c9",
      "x-device-name": "Test Device Name",
      "x-device-system-version": "14.4.2",
      "x-device-unique-id": "64e01335b0c646eda8851d4afd5bec04",
      "x-request-id": "4c5ce43c-7428-5781-9b89-0d774e8a977b",
    };

    const headersHash = createRsaSignature({
      algorithm: RsaAlgorithm.RSA_SHA512,
      data: JSON.stringify(headers),
      format: RsaFormat.BASE64,
      keySet: RSA_KEY_SET,
    });

    signature = [
      `algorithm="RSA-SHA512"`,
      `format="base64"`,
      `hash="${headersHash}"`,
      `headers="${Object.keys(headers).join(" ")}"`,
      `key="70656f6a-b043-5114-82f4-d3c947bfd5ed"`,
    ].join(",");

    ctx = {
      entity: {},
      request: { body },
      mongo: {
        publicKeyRepository: createMockMongoRepository(createTestPublicKey),
      },
      logger: createMockLogger(),
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case "date":
            return "Sun, 01 Jan 2023 08:00:00 GMT";
          case "digest":
            return digest;
          case "signature":
            return signature;
          case "x-device-installation-id":
            return "a185818a-d759-4741-bdb2-7c1d3526ff1d";
          case "x-device-link-id":
            return "76db1d22-fd02-4b59-8d30-d8b403e939c9";
          case "x-device-name":
            return "Test Device Name";
          case "x-device-system-version":
            return "14.4.2";
          case "x-device-unique-id":
            return "64e01335b0c646eda8851d4afd5bec04";
          case "x-request-id":
            return "4c5ce43c-7428-5781-9b89-0d774e8a977b";
        }
      }),
    };

    next = () => Promise.resolve();

    destructHeaderDigest.mockReturnValue({
      algorithm: "SHA512",
      format: "base64",
      hash: bodyHash,
    });

    destructHeaderSignature.mockReturnValue({
      algorithm: "RSA-SHA512",
      format: "base64",
      hash: headersHash,
      headers: Object.keys(headers),
      key: "70656f6a-b043-5114-82f4-d3c947bfd5ed",
    });
  });

  test("should resolve with all headers", async () => {
    await expect(signatureMiddleware(ctx, next)).resolves.not.toThrow();

    expect(ctx.entity.publicKey).toStrictEqual(expect.any(PublicKey));
  });

  test("should resolve without digest or signature header", async () => {
    ctx.get.mockImplementation((key: string) => {
      switch (key) {
        case "date":
          return "Sun, 01 Jan 2023 08:00:00 GMT";
        case "x-device-installation-id":
          return "a185818a-d759-4741-bdb2-7c1d3526ff1d";
        case "x-device-link-id":
          return "76db1d22-fd02-4b59-8d30-d8b403e939c9";
        case "x-device-name":
          return "Test Device Name";
        case "x-device-system-version":
          return "14.4.2";
        case "x-device-unique-id":
          return "64e01335b0c646eda8851d4afd5bec04";
        case "x-request-id":
          return "4c5ce43c-7428-5781-9b89-0d774e8a977b";
      }
    });

    await expect(signatureMiddleware(ctx, next)).resolves.not.toThrow();

    expect(ctx.entity.publicKey).toBeUndefined();
  });

  test("should throw on invalid digest hash", async () => {
    destructHeaderDigest.mockReturnValue({
      algorithm: "SHA512",
      format: "base64",
      hash: "invalid",
    });

    await expect(signatureMiddleware(ctx, next)).rejects.toThrow();
  });

  test("should throw on invalid signature hash", async () => {
    destructHeaderSignature.mockReturnValue({
      algorithm: "RSA-SHA512",
      format: "base64",
      hash: "invalid",
      headers: [
        "date",
        "digest",
        "x-device-installation-id",
        "x-device-link-id",
        "x-device-name",
        "x-device-system-version",
        "x-device-unique-id",
      ],
      key: "3b99f370-c70f-443a-9baa-2733b2bbb0c7",
    });

    await expect(signatureMiddleware(ctx, next)).rejects.toThrow();
  });

  test("should throw on missing date when signature exists", async () => {
    ctx.get.mockImplementation((key: string) => {
      switch (key) {
        case "date":
          return undefined;
        case "digest":
          return digest;
        case "signature":
          return signature;
        case "x-device-installation-id":
          return "a185818a-d759-4741-bdb2-7c1d3526ff1d";
        case "x-device-link-id":
          return "76db1d22-fd02-4b59-8d30-d8b403e939c9";
        case "x-device-name":
          return "Test Device Name";
        case "x-device-system-version":
          return "14.4.2";
        case "x-device-unique-id":
          return "64e01335b0c646eda8851d4afd5bec04";
        case "x-request-id":
          return "4c5ce43c-7428-5781-9b89-0d774e8a977b";
      }
    });

    await expect(signatureMiddleware(ctx, next)).rejects.toThrow();
  });

  test("should throw on missing digest when signature exists", async () => {
    ctx.get.mockImplementation((key: string) => {
      switch (key) {
        case "date":
          return "Sun, 01 Jan 2023 08:00:00 GMT";
        case "digest":
          return undefined;
        case "signature":
          return signature;
        case "x-device-installation-id":
          return "a185818a-d759-4741-bdb2-7c1d3526ff1d";
        case "x-device-link-id":
          return "76db1d22-fd02-4b59-8d30-d8b403e939c9";
        case "x-device-name":
          return "Test Device Name";
        case "x-device-system-version":
          return "14.4.2";
        case "x-device-unique-id":
          return "64e01335b0c646eda8851d4afd5bec04";
        case "x-request-id":
          return "4c5ce43c-7428-5781-9b89-0d774e8a977b";
      }
    });

    await expect(signatureMiddleware(ctx, next)).rejects.toThrow();
  });
});
