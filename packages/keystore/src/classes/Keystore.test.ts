import { createMockLogger } from "@lindorm-io/core-logger";
import MockDate from "mockdate";
import {
  KEY_PAIR_IS_ENC,
  KEY_PAIR_IS_EXPIRED,
  KEY_PAIR_IS_NOT_BEFORE,
  KEY_PAIR_SIG_EC,
  KEY_PAIR_SIG_OCT,
  KEY_PAIR_SIG_OKP,
  KEY_PAIR_SIG_RSA,
} from "../fixtures/stored-key-sets.fixture";
import { Keystore } from "./Keystore";

MockDate.set("2020-01-01T08:00:00.000Z");

describe("Keystore", () => {
  let keystore: Keystore;

  beforeEach(() => {
    keystore = new Keystore([], createMockLogger());
  });

  test("should have no keys", () => {
    expect(keystore.allKeys).toStrictEqual([]);
    expect(keystore.validKeys).toStrictEqual([]);
  });

  test("should return valid keys", () => {
    keystore = new Keystore([KEY_PAIR_SIG_EC], createMockLogger());

    expect(keystore.allKeys).toStrictEqual([KEY_PAIR_SIG_EC.webKeySet]);
    expect(keystore.validKeys).toStrictEqual([KEY_PAIR_SIG_EC.webKeySet]);
  });

  test("should not return expired keys", () => {
    keystore = new Keystore([KEY_PAIR_IS_EXPIRED], createMockLogger());

    expect(keystore.allKeys).toStrictEqual([KEY_PAIR_IS_EXPIRED.webKeySet]);
    expect(keystore.validKeys).toStrictEqual([]);
  });

  test("should not return keys that are not ready to be used", () => {
    keystore = new Keystore([KEY_PAIR_IS_NOT_BEFORE], createMockLogger());

    expect(keystore.allKeys).toStrictEqual([KEY_PAIR_IS_NOT_BEFORE.webKeySet]);
    expect(keystore.validKeys).toStrictEqual([]);
  });

  test("should add a key", () => {
    keystore.addKey(KEY_PAIR_SIG_EC);

    expect(keystore.allKeys).toStrictEqual([KEY_PAIR_SIG_EC.webKeySet]);
    expect(keystore.validKeys).toStrictEqual([KEY_PAIR_SIG_EC.webKeySet]);
  });

  test("should add multiple keys", () => {
    keystore.addKeys([KEY_PAIR_SIG_EC, KEY_PAIR_IS_EXPIRED]);

    expect(keystore.allKeys).toStrictEqual([
      KEY_PAIR_SIG_EC.webKeySet,
      KEY_PAIR_IS_EXPIRED.webKeySet,
    ]);
    expect(keystore.validKeys).toStrictEqual([KEY_PAIR_SIG_EC.webKeySet]);
  });

  test("should find keys", () => {
    keystore.addKeys([KEY_PAIR_SIG_EC, KEY_PAIR_SIG_OCT, KEY_PAIR_SIG_OKP, KEY_PAIR_SIG_RSA]);

    expect(keystore.findKeys("sig")).toStrictEqual([
      KEY_PAIR_SIG_EC.webKeySet,
      KEY_PAIR_SIG_OCT.webKeySet,
      KEY_PAIR_SIG_OKP.webKeySet,
      KEY_PAIR_SIG_RSA.webKeySet,
    ]);
  });

  test("should find a key", () => {
    keystore.addKeys([
      KEY_PAIR_SIG_EC,
      KEY_PAIR_SIG_OCT,
      KEY_PAIR_SIG_OKP,
      KEY_PAIR_SIG_RSA,
      KEY_PAIR_IS_ENC,
    ]);

    expect(keystore.findKey("sig", "EC")).toStrictEqual(KEY_PAIR_SIG_EC.webKeySet);
    expect(keystore.findKey("sig", "RSA")).toStrictEqual(KEY_PAIR_SIG_RSA.webKeySet);
    expect(keystore.findKey("enc")).toStrictEqual(KEY_PAIR_IS_ENC.webKeySet);
  });

  test("should get a key", () => {
    keystore.addKeys([
      KEY_PAIR_SIG_EC,
      KEY_PAIR_SIG_OCT,
      KEY_PAIR_SIG_OKP,
      KEY_PAIR_SIG_RSA,
      KEY_PAIR_IS_ENC,
    ]);

    expect(keystore.getKey(KEY_PAIR_SIG_EC.id)).toStrictEqual(KEY_PAIR_SIG_EC.webKeySet);
  });

  test("should get jwks", () => {
    keystore.addKey(KEY_PAIR_SIG_EC);

    expect(keystore.getJwks()).toStrictEqual([
      {
        alg: "ES512",
        crv: "P-521",
        exp: 4070908800,
        expires_in: 2493043200,
        iat: 1577174400,
        jku: "https://example.com/jwks.json",
        key_ops: ["sign", "verify"],
        kid: "971c8839-af23-545f-8e2b-2f31d3e3af11",
        kty: "EC",
        nbf: 1577836800,
        owner_id: "2ce9eb4b-1088-577e-a065-c3383e7c821f",
        uat: 1577520000,
        use: "sig",
        x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
        y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
      },
    ]);
  });
});
