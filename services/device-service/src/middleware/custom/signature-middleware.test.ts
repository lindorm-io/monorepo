import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { PublicKey } from "../../entity";
import { createTestPublicKey } from "../../fixtures/entity";
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
  let next: () => Promise<void>;

  beforeEach(() => {
    digest = [
      `algorithm="SHA512"`,
      `format="base64"`,
      `hash="CDfArYwmrrHV2CnGBP+y0uWZvHeSEAUNzAnGplRYZA/hICyhBKlfCC577qcyHAhvh8NGrLufKq0moA49PGcU6w=="`,
    ].join(",");

    ctx = {
      entity: {},
      request: {
        body: {
          foo: "bar",
          bar: "baz",
          random: "TNUakzVKuuVNeESg",
        },
      },
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

          case "signature":
            return "signature";
        }
      }),
    };

    next = () => Promise.resolve();

    destructHeaderDigest.mockReturnValue({
      algorithm: "SHA512",
      format: "base64",
      hash: "CDfArYwmrrHV2CnGBP+y0uWZvHeSEAUNzAnGplRYZA/hICyhBKlfCC577qcyHAhvh8NGrLufKq0moA49PGcU6w==",
    });

    destructHeaderSignature.mockReturnValue({
      algorithm: "RSA-SHA512",
      format: "base64",
      hash: "JpfOTcLNyqYiK1TmLrZ/wh+3uITzjtETqCK/Y7uOyCQ86TswXhaCiAYlxCp6dDzUuc4tp122Oa48KIybhQwaMl74ljM1xkXIpor1mlzb7eMT0JrydOOz1ps8PhQMy8y+gYI+TsLsCPcrbe1UBq9huOnK1UHwh/kSkgFe4kBTfzkfVJg8JGah8bf6HASEt0bV4kcKCUuMabTOe2RGiuENW26HTwaQU+TUWpDDVmlY13C0ywtqLr+1q5+5ZZX54Ip+ZtMH9Nt3hS7qxRwBl0nItp8psb777ITbw9z1WJ/WT/d3E4l/10lPNEr1IlPdZSPGjfLcfEoAJCv7CXj8gyOnmpo5cTjGIWzQI+1hEoaLMTTMf/2mLbMoYPX4tx8o/4h7ffJt3mQgdseqvcHHgsYI1f+bFAw+V3p9JQKYYNBbh/7YrXFnNx7cdJ7rNelGsjefeLXdf2FhNgaFiXVKJAKI9whbUyXhet2Qy7L8XFkI+eOtB8lzvR/e5hA68qO9t7VAhlLKiKxYHGgCyuWEMMYXcEGDItaJoIIwWGtL/PsBs0xpWDSb4qwQc9pxMQcAmiq6XP0vkO1a5dKL3mjPembvuiN+dkuMy0kgoaWGbW3txIDk6GIPesTDKVH/nM3bBBsScbcQke5DQw+zluoOxYX5lnXsh/4AGZhe+f1vtSJhzoE=",
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

        case "signature":
          return "signature";
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

        case "signature":
          return "signature";
      }
    });

    await expect(signatureMiddleware(ctx, next)).rejects.toThrow();
  });
});
