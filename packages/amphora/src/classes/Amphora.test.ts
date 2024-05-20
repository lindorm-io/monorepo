import { Kryptos } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import nock from "nock";
import {
  OPEN_ID_CONFIGURATION_RESPONSE,
  OPEN_ID_JWKS_RESPONSE,
} from "../__fixtures__/auth0";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_SIG,
} from "../__fixtures__/keys";
import { Amphora } from "./Amphora";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("Amphora", () => {
  const issuer = "https://test.lindorm.io/";

  let amphora: Amphora;

  beforeEach(() => {
    amphora = new Amphora({ issuer, logger: createMockLogger() });
  });

  describe("add", () => {
    test("should add key to vault", () => {
      amphora.add(TEST_EC_KEY_SIG);

      expect(amphora.vault).toEqual([TEST_EC_KEY_SIG]);
    });

    test("should add multiple keys to vault", () => {
      amphora.add([
        TEST_EC_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_RSA_KEY_SIG,
      ]);

      expect(amphora.vault).toEqual([
        TEST_EC_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_RSA_KEY_SIG,
      ]);
    });

    test("should only keep one copy of each key id", () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_EC_KEY_SIG, TEST_EC_KEY_SIG, TEST_EC_KEY_SIG]);

      expect(amphora.vault).toEqual([TEST_EC_KEY_SIG]);
    });

    test("should update jwks when adding key", () => {
      amphora.add([
        TEST_EC_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_RSA_KEY_SIG,
      ]);

      expect(amphora.jwks).toEqual({
        keys: [
          {
            alg: "RS512",
            e: "AQAB",
            exp: 1717200000,
            iat: 1704067560,
            iss: "https://test.lindorm.io/",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            key_ops: ["sign", "verify"],
            kid: "aaac22b3-2253-5598-8e0c-1733fc748122",
            kty: "RSA",
            n: "7cxLHoxaHdYU8EX2ij5m42XIQYWBUxKMOfVbV2OX0nNHEdojXfRfONvrAHwsvRqcdN44yv1E1be18qs5HRB67D3qLeRjXcjegdjWvQj66IFVZIxQHNJ-LXDbAYs7gez8RYbBObnDzfrqy9vIPZet1tbqvlxv9aTR38x3ORJ4Y6Ym9StbKOUIo7BLIvoc1M5uNUIEnFKKZhbmVR423-F50w_E0618KExZgeur_8cMsSWZxyl0oeSI-rIodjfVJbshT1yy98zKRj-mMnyPKgHQARr9SwDA5Xlt9L2fVZ72xgwaPOBUgFoDTPQsqQ3Rkj7nYUSqwQVEL0-oH2K7U3OeGeKyIQMNzRdSfYMw3gSc5dtwqX64oK33lN2jzTKa0clSZjqJ4jzUL1YrXMddF07dMQqjN2mGjeZVy5LaO4B58Y5l-kO01KdwA-_LcDhkNgbKiZMZVtNPlVkR3nCvInt5cqPOqMOcLW3oA1wmh7zauWqorklpSSs75zw8ETtzATSJv8h7kUG9Bl1QQgdBkGqKb4ZG-r5Bj6pwJrHVmgPSMowP8P9G13iQLFdKX714A3DMKDc03TJvs2yVK81YUCtO5aRdwb0q0YcFqn9BHI3cmO-kOhXquMakPQ3zW_FBSnIeBhJMObCQOmYEuZxrifMcCQTY7j5jsP962e7ZPn53STc",
            nbf: 1672534800,
            uat: 1704095940,
            use: "sig",
          },
          {
            alg: "EdDSA",
            crv: "Ed25519",
            exp: 1717200000,
            iat: 1704067500,
            iss: "https://test.lindorm.io/",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            key_ops: ["sign", "verify"],
            kid: "2fa52a91-7f63-5731-a55d-30d36350c642",
            kty: "OKP",
            nbf: 1672534800,
            uat: 1704095940,
            use: "sig",
            x: "GRCwCA6lChosFGMQwxGiHCdzblfvCz0FNiRtTnm1qqc",
          },
          {
            alg: "ES512",
            crv: "P-521",
            exp: 1717200000,
            iat: 1704067260,
            iss: "https://test.lindorm.io/",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            key_ops: ["sign", "verify"],
            kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
            kty: "EC",
            nbf: 1672534800,
            uat: 1704095940,
            use: "sig",
            x: "AI3Y8hWlFN19cuY3GSDwGTabmd62piw1bYt5-GSWvaN8mJVQlQM-hmgZ9psbMcSCwqM_YdFs-wQj-00PfHg31VbR",
            y: "AAgPZRhdrsY3SLMdYgVF2NVi5Hn7SPLAW136j83Y852u-VXzG6Z1Ur5OJI8Qh18qgv8i7R7sgpOwmyP5SYTysMmf",
          },
        ],
      });
    });
  });

  describe("find & filter", () => {
    test("should filter kryptos by active", async () => {
      const key = TEST_EC_KEY_SIG.clone();
      key.notBefore = new Date("2099-01-01T00:00:00.000Z");

      amphora.add([key, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer })).resolves.toEqual([TEST_OCT_KEY_SIG]);
    });

    test("should filter kryptos by issuer", async () => {
      const kryptos = Kryptos.generate(
        {
          algorithm: "HS256",
          type: "oct",
          use: "sig",
        },
        {
          issuer: "https://other.lindorm.io/",
        },
      );

      amphora.add([kryptos, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer })).resolves.toEqual([TEST_OCT_KEY_SIG]);
    });

    test("should find kryptos in vault using id", async () => {
      amphora.add(TEST_EC_KEY_SIG);

      await expect(amphora.find({ issuer, id: TEST_EC_KEY_SIG.id })).resolves.toEqual(
        TEST_EC_KEY_SIG,
      );
    });

    test("should filter kryptos and sort them by creation date", async () => {
      amphora.add([
        TEST_EC_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_RSA_KEY_SIG,
      ]);

      await expect(amphora.filter({ issuer, private: true })).resolves.toEqual([
        TEST_RSA_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the private query", async () => {
      const { privateKey, ...der } = TEST_OKP_KEY_SIG.export("der");
      const key = Kryptos.from("der", { issuer, ...der });

      amphora.add([TEST_EC_KEY_SIG, key]);

      await expect(amphora.filter({ issuer, private: true })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the public query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer, public: true })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the operation query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG, TEST_OCT_KEY_ENC]);

      await expect(amphora.filter({ issuer, operation: "deriveKey" })).resolves.toEqual([
        TEST_OCT_KEY_ENC,
      ]);
    });

    test("should filter kryptos in vault using the type query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer, type: "oct" })).resolves.toEqual([
        TEST_OCT_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the use query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC]);

      await expect(amphora.filter({ issuer, use: "sig" })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });
  });

  describe("external config", () => {
    test("should add external config and find jwks", async () => {
      nock("https://lindorm.eu.auth0.com")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

      nock("https://lindorm.eu.auth0.com")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, OPEN_ID_JWKS_RESPONSE);

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [TEST_EC_KEY_SIG.toJWK("private")] });

      amphora = new Amphora({
        issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
          {
            openIdConfigurationUri:
              "https://lindorm.eu.auth0.com/.well-known/openid-configuration",
          },
        ],
      });

      expect(amphora.config).toEqual([]);

      await amphora.setup();

      expect(amphora.config).toEqual([
        {
          issuer: "https://external.lindorm.io/",
          jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
        },
        {
          issuer: "https://lindorm.eu.auth0.com/",
          jwksUri: "https://lindorm.eu.auth0.com/.well-known/jwks.json",
        },
      ]);

      expect(amphora.vault).toEqual([
        expect.objectContaining({
          id: expect.any(String),
          type: "EC",
        }),
        expect.objectContaining({ id: "iPy9pgzr7cFw1kTuiClWE", type: "RSA" }),
        expect.objectContaining({ id: "IjICkHcf-qq8_stUQ00IN", type: "RSA" }),
      ]);
    });

    test("should add use external config when vault is unable to find key", async () => {
      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [TEST_EC_KEY_SIG.toJWK("private")] });

      amphora = new Amphora({
        issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer,
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await expect(amphora.find({ issuer, id: TEST_EC_KEY_SIG.id })).resolves.toEqual(
        expect.objectContaining({ id: TEST_EC_KEY_SIG.id }),
      );
    });
  });
});
