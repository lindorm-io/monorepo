import { KryptosKit } from "@lindorm/kryptos";
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
  TEST_OKP_KEY_ENC,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_SIG,
} from "../__fixtures__/keys";
import { AmphoraError } from "../errors";
import { Amphora } from "./Amphora";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("Amphora", () => {
  const issuer = "https://test.lindorm.io/";

  let amphora: Amphora;

  beforeEach(() => {
    amphora = new Amphora({ domain: issuer, logger: createMockLogger() });
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

      expect(amphora.jwks).toMatchSnapshot();
    });
  });

  describe("env", () => {
    test("should add keys to vault from env", () => {
      amphora.env([
        "kryptos:eyJlbmMiOiJBMTkyR0NNIiwiaWF0IjoxNzQ0NzA0MjYzLCJrZXlfb3BzIjpbImRlcml2ZUtleSJdLCJuYmYiOjE3NDQ3MDQyNjMsInB1cnBvc2UiOiJ0ZXN0IiwidWF0IjoxNzQ0NzA0MjYzLCJjcnYiOiJQLTM4NCIsIngiOiJGMTgyVlNMMURyRll5b19feVJ3eXlvS3JtT08wVEU0MktxT0pOQk1CNlgxSlFYbGV1MTVqYVpsN3dHdG5XcmxUIiwieSI6IlM3bElSZG45dlh5QnF4S0FSUTZzampLcXlCekt1T3VJM1BYcExlUEZ3bmpXNDduWEVVN2hDMzNydmF5ZzVZbVkiLCJkIjoiVzlRNmZMc2J2NkN0dk1zWUUyOTJha2VqeUlZeHFUY1BGSTQzUE9Fd1dpeVRrMFhhelk4NEREQnpHZlNVNEhmOCIsImtpZCI6IjE2NmM2YWI2LWRmOWYtNGZkYS1hYWI4LTkyMTM5ZWY2NDc5MiIsImFsZyI6IkVDREgtRVMrQTE5MktXIiwidXNlIjoiZW5jIiwia3R5IjoiRUMifQ",
        "kryptos:eyJpYXQiOjE3NDQ3MDQyMjgsImtleV9vcHMiOlsic2lnbiIsInZlcmlmeSJdLCJuYmYiOjE3NDQ3MDQyMjgsInB1cnBvc2UiOiJ0ZXN0IiwidWF0IjoxNzQ0NzA0MjI4LCJjcnYiOiJFZDI1NTE5IiwieCI6IlBqeDJjSWRtS0lkdGh5V2ZEakxjTnlKOWt6RW9ObnlWWjZCckZVZWUxc2ciLCJkIjoiMzhFS1ZrRjZBaGM0RWFUNm9XcWlGajdzejZ3czdjLXk2ZjgycHAzNHNFZyIsImtpZCI6IjM4MTQ0NTdmLTI2OGItNGQyMi1hNjQ0LTZhZTY5YjdjNzRiMSIsImFsZyI6IkVkRFNBIiwidXNlIjoic2lnIiwia3R5IjoiT0tQIn0",
      ]);

      expect(amphora.vault).toEqual([
        expect.objectContaining({
          id: "166c6ab6-df9f-4fda-aab8-92139ef64792",
          type: "EC",
        }),
        expect.objectContaining({
          id: "3814457f-268b-4d22-a644-6ae69b7c74b1",
          type: "OKP",
        }),
      ]);
    });
  });

  describe("filter", () => {
    test("should filter kryptos by active", async () => {
      const key = KryptosKit.clone(TEST_EC_KEY_SIG, {
        notBefore: new Date("2099-01-01T00:00:00.000Z"),
      });

      amphora.add([key, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer })).resolves.toEqual([TEST_OCT_KEY_SIG]);
    });

    test("should filter kryptos by issuer", async () => {
      const kryptos = KryptosKit.generate.sig.oct({
        algorithm: "HS256",
        issuer: "https://other.lindorm.io/",
      });

      amphora.add([kryptos, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer })).resolves.toEqual([TEST_OCT_KEY_SIG]);
    });

    test("should filter kryptos and sort them by creation date", async () => {
      amphora.add([
        TEST_EC_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_RSA_KEY_SIG,
      ]);

      await expect(amphora.filter({ issuer, hasPrivateKey: true })).resolves.toEqual([
        TEST_RSA_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the private query", async () => {
      const { privateKey, ...der } = TEST_OKP_KEY_SIG.export("der");
      const key = KryptosKit.from.der({ issuer, ...der });

      amphora.add([TEST_EC_KEY_SIG, key]);

      await expect(amphora.filter({ issuer, hasPrivateKey: true })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the public query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer, hasPublicKey: true })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the operation query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG, TEST_OCT_KEY_ENC]);

      await expect(
        amphora.filter({ issuer, operations: ["deriveKey"] }),
      ).resolves.toEqual([TEST_OCT_KEY_ENC]);
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

    test("should filter kryptos in vault synchronously", async () => {
      amphora.add(TEST_EC_KEY_SIG);

      expect(amphora.filterSync({ issuer, id: TEST_EC_KEY_SIG.id })).toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });
  });

  describe("find", () => {
    test("should find kryptos in vault using id", async () => {
      amphora.add(TEST_EC_KEY_SIG);

      await expect(amphora.find({ issuer, id: TEST_EC_KEY_SIG.id })).resolves.toEqual(
        TEST_EC_KEY_SIG,
      );
    });

    test("should find kryptos in vault synchronously", async () => {
      amphora.add(TEST_EC_KEY_SIG);

      expect(amphora.findSync({ issuer, id: TEST_EC_KEY_SIG.id })).toEqual(
        TEST_EC_KEY_SIG,
      );
    });
  });

  describe("can", () => {
    test("should return true for canEncrypt", () => {
      amphora.add(TEST_OCT_KEY_ENC);

      expect(amphora.canEncrypt()).toBe(true);
    });

    test("should return false for canEncrypt", () => {
      expect(amphora.canEncrypt()).toBe(false);
    });

    test("should return true for canDecrypt", () => {
      amphora.add(TEST_OCT_KEY_ENC);

      expect(amphora.canDecrypt()).toBe(true);
    });

    test("should return false for canDecrypt", () => {
      expect(amphora.canDecrypt()).toBe(false);
    });

    test("should return true for canSign", () => {
      amphora.add(TEST_RSA_KEY_SIG);

      expect(amphora.canSign()).toBe(true);
    });

    test("should return false for canSign", () => {
      expect(amphora.canSign()).toBe(false);
    });

    test("should return true for canVerify", () => {
      amphora.add(TEST_RSA_KEY_SIG);

      expect(amphora.canVerify()).toBe(true);
    });

    test("should return false for canVerify", () => {
      expect(amphora.canVerify()).toBe(false);
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

      nock("https://lindorm.jp.auth0.com")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, {
          ...OPEN_ID_CONFIGURATION_RESPONSE,
          issuer: "https://lindorm.jp.auth0.io/",
          jwksUri: "https://lindorm.jp.auth0.com/.well-known/jwks.json",
        });

      const okpJwk = TEST_OKP_KEY_ENC.toJWK();
      delete okpJwk.iss;

      nock("https://lindorm.jp.auth0.com")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [okpJwk] });

      const ecJwk = TEST_EC_KEY_SIG.toJWK("private");
      delete ecJwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [ecJwk] });

      amphora = new Amphora({
        domain: issuer,
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
          {
            issuer: "https://lindorm.jp.auth0.com/",
          },
        ],
      });

      expect(amphora.config).toEqual([]);

      await amphora.setup();

      expect(amphora.config).toMatchSnapshot();

      expect(amphora.vault).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            type: "EC",
          }),
          expect.objectContaining({
            id: expect.any(String),
            type: "OKP",
          }),
          expect.objectContaining({ id: "iPy9pgzr7cFw1kTuiClWE", type: "RSA" }),
          expect.objectContaining({ id: "IjICkHcf-qq8_stUQ00IN", type: "RSA" }),
        ]),
      );
    });

    test("should add use external config when vault is unable to find key", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        domain: issuer,
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

  describe("domain validation", () => {
    test("should throw AmphoraError when domain is not a valid URL", () => {
      expect(
        () =>
          new Amphora({
            domain: "not-a-url",
            logger: createMockLogger(),
          }),
      ).toThrow(AmphoraError);
    });

    test("should throw AmphoraError with debug context when domain is invalid", () => {
      expect(
        () =>
          new Amphora({
            domain: "not-a-url",
            logger: createMockLogger(),
          }),
      ).toThrow("Domain must be a valid URL");
    });
  });

  describe("error context for find()", () => {
    test("should include debug context in error when key not found", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      try {
        await amphora.find({ issuer, id: "non-existent-id" });
        fail("Expected find() to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).message).toBe(
          "Kryptos not found using query after refresh",
        );
        expect((error as AmphoraError).debug).toEqual({
          queryKeys: ["issuer", "id"],
          totalKeys: 2,
          activeKeys: 2,
        });
      }
    });
  });

  describe("error context for findSync()", () => {
    test("should include debug context in error when key not found", () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      try {
        amphora.findSync({ issuer, id: "non-existent-id" });
        fail("Expected findSync() to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).message).toBe(
          "Kryptos not found using query (sync, no refresh)",
        );
        expect((error as AmphoraError).debug).toEqual({
          queryKeys: ["issuer", "id"],
          totalKeys: 2,
          activeKeys: 2,
        });
      }
    });
  });

  describe("refresh deduplication", () => {
    test("should deduplicate concurrent refresh calls", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await Promise.all([amphora.refresh(), amphora.refresh(), amphora.refresh()]);

      expect(nock.isDone()).toBe(true);
      expect(amphora.vault).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: TEST_EC_KEY_SIG.id,
            type: "EC",
          }),
        ]),
      );
    });
  });

  describe("setup deduplication", () => {
    test("should deduplicate concurrent setup calls", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await Promise.all([amphora.setup(), amphora.setup(), amphora.setup()]);

      expect(nock.isDone()).toBe(true);
      expect(amphora.vault).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: TEST_EC_KEY_SIG.id,
            type: "EC",
          }),
        ]),
      );
    });
  });

  describe("lazy setup", () => {
    test("should auto-setup on first filter() call with external providers", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      const result = await amphora.filter({ issuer: "https://external.lindorm.io/" });

      expect(nock.isDone()).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "EC",
            issuer: "https://external.lindorm.io/",
          }),
        ]),
      );
    });

    test("should throw from filterSync when setup not called with external providers", () => {
      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      expect(() => amphora.filterSync({ issuer })).toThrow(AmphoraError);
      expect(() => amphora.filterSync({ issuer })).toThrow(
        "setup() must be called before using sync methods with external providers",
      );
    });

    test("should throw from findSync when setup not called with external providers", () => {
      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      expect(() => amphora.findSync({ issuer, id: "some-id" })).toThrow(AmphoraError);
      expect(() => amphora.findSync({ issuer, id: "some-id" })).toThrow(
        "setup() must be called before using sync methods with external providers",
      );
    });

    test("should not require setup for filter with no external providers", async () => {
      amphora.add(TEST_EC_KEY_SIG);

      await expect(amphora.filter({ issuer, id: TEST_EC_KEY_SIG.id })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });
  });

  describe("config deduplication", () => {
    test("should not duplicate config on repeated refresh", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(2)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      expect(amphora.config.length).toBe(1);

      await amphora.refresh();

      expect(amphora.config.length).toBe(1);
    });

    test("should throw when all providers fail", async () => {
      nock("https://external.lindorm.io")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(500, { error: "Internal Server Error" });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(AmphoraError);
      await expect(amphora.setup()).rejects.toThrow(
        "All external config providers failed during refresh",
      );
    });
  });

  describe("external JWKS resilience", () => {
    test("should continue refreshing when one JWKS provider fails", async () => {
      const goodJwk = TEST_EC_KEY_SIG.toJWK("private");
      delete goodJwk.iss;

      nock("https://good-provider.com")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [goodJwk] });

      nock("https://bad-provider.com")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(500, { error: "Internal Server Error" });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://good-provider.com/",
            jwksUri: "https://good-provider.com/.well-known/jwks.json",
          },
          {
            issuer: "https://bad-provider.com/",
            jwksUri: "https://bad-provider.com/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      expect(amphora.vault).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: TEST_EC_KEY_SIG.id,
            type: "EC",
            issuer: "https://good-provider.com/",
          }),
        ]),
      );

      const badProviderKeys = amphora.vault.filter(
        (k) => k.issuer === "https://bad-provider.com/",
      );
      expect(badProviderKeys).toHaveLength(0);
    });

    test("should reject keys with mismatched issuer", async () => {
      const jwkWithWrongIssuer = TEST_EC_KEY_SIG.toJWK("private");
      jwkWithWrongIssuer.iss = "https://attacker.com/";

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwkWithWrongIssuer] });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(AmphoraError);
      await expect(amphora.setup()).rejects.toThrow(
        "All external JWKS providers failed during refresh",
      );

      const externalKeys = amphora.vault.filter(
        (k) => k.issuer === "https://external.lindorm.io/",
      );
      expect(externalKeys).toHaveLength(0);
    });

    test("should truncate when provider returns too many keys", async () => {
      const jwk1 = { ...TEST_EC_KEY_SIG.toJWK("private"), kid: "key-1" };
      const jwk2 = { ...TEST_EC_KEY_SIG.toJWK("private"), kid: "key-2" };
      const jwk3 = { ...TEST_EC_KEY_SIG.toJWK("private"), kid: "key-3" };
      const jwk4 = { ...TEST_EC_KEY_SIG.toJWK("private"), kid: "key-4" };
      const jwk5 = { ...TEST_EC_KEY_SIG.toJWK("private"), kid: "key-5" };

      delete jwk1.iss;
      delete jwk2.iss;
      delete jwk3.iss;
      delete jwk4.iss;
      delete jwk5.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk1, jwk2, jwk3, jwk4, jwk5] });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        maxExternalKeys: 2,
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      const externalKeys = amphora.vault.filter(
        (k) => k.issuer === "https://external.lindorm.io/",
      );
      expect(externalKeys).toHaveLength(2);
    });

    test("should preserve locally-added keys during external refresh", async () => {
      const localKey = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://external.lindorm.io/",
      });

      const externalJwk = TEST_EC_KEY_SIG.toJWK("private");
      delete externalJwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [externalJwk] });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      amphora.add(localKey);

      await amphora.setup();

      const localKeyInVault = amphora.vault.find((k) => k.id === localKey.id);
      expect(localKeyInVault).toBeDefined();
      expect(localKeyInVault?.issuer).toBe("https://external.lindorm.io/");
      expect(localKeyInVault?.isExternal).toBe(false);

      const externalKeyInVault = amphora.vault.find((k) => k.id === TEST_EC_KEY_SIG.id);
      expect(externalKeyInVault).toBeDefined();
      expect(externalKeyInVault?.issuer).toBe("https://external.lindorm.io/");
      expect(externalKeyInVault?.isExternal).toBe(true);
    });
  });
});
