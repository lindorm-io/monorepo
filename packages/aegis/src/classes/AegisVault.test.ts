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
import { AegisVault } from "./AegisVault";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("AegisVault", () => {
  const issuer = "https://test.lindorm.io/";

  let vault: AegisVault;

  beforeEach(() => {
    vault = new AegisVault({ logger: createMockLogger() });
  });

  describe("add", () => {
    test("should add key to vault", () => {
      vault.add(TEST_EC_KEY_SIG);

      expect(vault.vault).toEqual([TEST_EC_KEY_SIG]);
    });

    test("should add multiple keys to vault", () => {
      vault.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG, TEST_OKP_KEY_SIG, TEST_RSA_KEY_SIG]);

      expect(vault.vault).toEqual([
        TEST_EC_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_RSA_KEY_SIG,
      ]);
    });

    test("should only keep one copy of each key id", () => {
      vault.add([TEST_EC_KEY_SIG, TEST_EC_KEY_SIG, TEST_EC_KEY_SIG, TEST_EC_KEY_SIG]);

      expect(vault.vault).toEqual([TEST_EC_KEY_SIG]);
    });
  });

  describe("find & filter", () => {
    test("should filter kryptos by active", async () => {
      const key = TEST_EC_KEY_SIG.clone();
      key.notBefore = new Date("2099-01-01T00:00:00.000Z");

      vault.add([key, TEST_OCT_KEY_SIG]);

      await expect(vault.filter({ issuer })).resolves.toEqual([TEST_OCT_KEY_SIG]);
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

      vault.add([kryptos, TEST_OCT_KEY_SIG]);

      await expect(vault.filter({ issuer })).resolves.toEqual([TEST_OCT_KEY_SIG]);
    });

    test("should find kryptos in vault using id", async () => {
      vault.add(TEST_EC_KEY_SIG);

      await expect(vault.find({ issuer, id: TEST_EC_KEY_SIG.id })).resolves.toEqual(
        TEST_EC_KEY_SIG,
      );
    });

    test("should filter kryptos and sort them by creation date", async () => {
      vault.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG, TEST_OKP_KEY_SIG, TEST_RSA_KEY_SIG]);

      await expect(vault.filter({ issuer, private: true })).resolves.toEqual([
        TEST_RSA_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the private query", async () => {
      const { privateKey, ...der } = TEST_OKP_KEY_SIG.export("der");
      const key = Kryptos.from("der", { issuer, ...der });

      vault.add([TEST_EC_KEY_SIG, key]);

      await expect(vault.filter({ issuer, private: true })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the public query", async () => {
      vault.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      await expect(vault.filter({ issuer, public: true })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the operation query", async () => {
      vault.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG, TEST_OCT_KEY_ENC]);

      await expect(vault.filter({ issuer, operation: "deriveKey" })).resolves.toEqual([
        TEST_OCT_KEY_ENC,
      ]);
    });

    test("should filter kryptos in vault using the type query", async () => {
      vault.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      await expect(vault.filter({ issuer, type: "oct" })).resolves.toEqual([
        TEST_OCT_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the use query", async () => {
      vault.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC]);

      await expect(vault.filter({ issuer, use: "sig" })).resolves.toEqual([
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

      nock("https://test.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [TEST_EC_KEY_SIG.toJWK("private")] });

      vault = new AegisVault({
        logger: createMockLogger(),
        external: [
          {
            issuer,
            jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          },
          {
            openIdConfigurationUri:
              "https://lindorm.eu.auth0.com/.well-known/openid-configuration",
          },
        ],
      });

      expect(vault.config).toEqual([]);

      await vault.setup();

      expect(vault.config).toEqual([
        {
          issuer: "https://test.lindorm.io/",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        },
        {
          issuer: "https://lindorm.eu.auth0.com/",
          jwksUri: "https://lindorm.eu.auth0.com/.well-known/jwks.json",
        },
      ]);

      expect(vault.vault).toEqual([
        expect.objectContaining({
          id: expect.any(String),
          type: "EC",
        }),
        expect.objectContaining({ id: "iPy9pgzr7cFw1kTuiClWE", type: "RSA" }),
        expect.objectContaining({ id: "IjICkHcf-qq8_stUQ00IN", type: "RSA" }),
      ]);
    });

    test("should add use external config when vault is unable to find key", async () => {
      nock("https://test.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [TEST_EC_KEY_SIG.toJWK("private")] });

      vault = new AegisVault({
        logger: createMockLogger(),
        external: [
          {
            issuer,
            jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await expect(vault.find({ issuer, id: TEST_EC_KEY_SIG.id })).resolves.toEqual(
        expect.objectContaining({ id: TEST_EC_KEY_SIG.id }),
      );
    });
  });
});
