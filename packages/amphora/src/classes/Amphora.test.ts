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

      nock("https://lindorm.jp.auth0.com")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [TEST_OKP_KEY_ENC.toJWK()] });

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
