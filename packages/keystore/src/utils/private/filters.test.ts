import MockDate from "mockdate";
import {
  KEY_PAIR_IS_ENC,
  KEY_PAIR_IS_EXPIRED,
  KEY_PAIR_IS_EXTERNAL,
  KEY_PAIR_IS_NOT_BEFORE,
  KEY_PAIR_SIG_EC,
  KEY_PAIR_SIG_OCT,
  KEY_PAIR_SIG_OKP,
  KEY_PAIR_SIG_RSA,
} from "../../fixtures/stored-key-sets.fixture";
import {
  isKeySetActive,
  isKeySetCorrectType,
  isKeySetCorrectUsage,
  isKeySetExternal,
  isKeySetNotExpired,
  isKeySetPrivate,
  isKeySetPublic,
} from "./filters";

MockDate.set("2020-01-01T08:00:00.000Z");

describe("filters", () => {
  test("isKeyActive", () => {
    expect(isKeySetActive(KEY_PAIR_SIG_EC.webKeySet)).toBe(true);
    expect(isKeySetActive(KEY_PAIR_SIG_OCT.webKeySet)).toBe(true);
    expect(isKeySetActive(KEY_PAIR_SIG_OKP.webKeySet)).toBe(true);
    expect(isKeySetActive(KEY_PAIR_SIG_RSA.webKeySet)).toBe(true);
    expect(isKeySetActive(KEY_PAIR_IS_ENC.webKeySet)).toBe(true);
    expect(isKeySetActive(KEY_PAIR_IS_EXPIRED.webKeySet)).toBe(true);
    expect(isKeySetActive(KEY_PAIR_IS_NOT_BEFORE.webKeySet)).toBe(false);
    expect(isKeySetActive(KEY_PAIR_IS_EXTERNAL.webKeySet)).toBe(true);
  });

  test("isKeyCorrectType", () => {
    expect(isKeySetCorrectType("EC")(KEY_PAIR_SIG_EC.webKeySet)).toBe(true);
    expect(isKeySetCorrectType("oct")(KEY_PAIR_SIG_OCT.webKeySet)).toBe(true);
    expect(isKeySetCorrectType("OKP")(KEY_PAIR_SIG_OKP.webKeySet)).toBe(true);
    expect(isKeySetCorrectType("RSA")(KEY_PAIR_SIG_RSA.webKeySet)).toBe(true);
    expect(isKeySetCorrectType("RSA")(KEY_PAIR_IS_ENC.webKeySet)).toBe(true);
    expect(isKeySetCorrectType("RSA")(KEY_PAIR_IS_EXPIRED.webKeySet)).toBe(true);
    expect(isKeySetCorrectType("RSA")(KEY_PAIR_IS_NOT_BEFORE.webKeySet)).toBe(true);
    expect(isKeySetCorrectType("RSA")(KEY_PAIR_IS_EXTERNAL.webKeySet)).toBe(true);
  });

  test("isKeyCorrectUsage", () => {
    expect(isKeySetCorrectUsage("sig")(KEY_PAIR_SIG_EC.webKeySet)).toBe(true);
    expect(isKeySetCorrectUsage("sig")(KEY_PAIR_SIG_OCT.webKeySet)).toBe(true);
    expect(isKeySetCorrectUsage("sig")(KEY_PAIR_SIG_OKP.webKeySet)).toBe(true);
    expect(isKeySetCorrectUsage("sig")(KEY_PAIR_SIG_RSA.webKeySet)).toBe(true);
    expect(isKeySetCorrectUsage("enc")(KEY_PAIR_IS_ENC.webKeySet)).toBe(true);
    expect(isKeySetCorrectUsage("sig")(KEY_PAIR_IS_EXPIRED.webKeySet)).toBe(true);
    expect(isKeySetCorrectUsage("sig")(KEY_PAIR_IS_NOT_BEFORE.webKeySet)).toBe(true);
    expect(isKeySetCorrectUsage("sig")(KEY_PAIR_IS_EXTERNAL.webKeySet)).toBe(true);
  });

  test("isKeyExternal", () => {
    expect(isKeySetExternal(true)(KEY_PAIR_SIG_EC.webKeySet)).toBe(false);
    expect(isKeySetExternal(true)(KEY_PAIR_SIG_OCT.webKeySet)).toBe(false);
    expect(isKeySetExternal(true)(KEY_PAIR_SIG_OKP.webKeySet)).toBe(false);
    expect(isKeySetExternal(true)(KEY_PAIR_SIG_RSA.webKeySet)).toBe(false);
    expect(isKeySetExternal(true)(KEY_PAIR_IS_ENC.webKeySet)).toBe(true);
    expect(isKeySetExternal(true)(KEY_PAIR_IS_EXPIRED.webKeySet)).toBe(false);
    expect(isKeySetExternal(true)(KEY_PAIR_IS_NOT_BEFORE.webKeySet)).toBe(false);
    expect(isKeySetExternal(true)(KEY_PAIR_IS_EXTERNAL.webKeySet)).toBe(true);
  });

  test("isKeyNotExpired", () => {
    expect(isKeySetNotExpired(KEY_PAIR_SIG_EC.webKeySet)).toBe(true);
    expect(isKeySetNotExpired(KEY_PAIR_SIG_OCT.webKeySet)).toBe(true);
    expect(isKeySetNotExpired(KEY_PAIR_SIG_OKP.webKeySet)).toBe(true);
    expect(isKeySetNotExpired(KEY_PAIR_SIG_RSA.webKeySet)).toBe(true);
    expect(isKeySetNotExpired(KEY_PAIR_IS_ENC.webKeySet)).toBe(true);
    expect(isKeySetNotExpired(KEY_PAIR_IS_EXPIRED.webKeySet)).toBe(false);
    expect(isKeySetNotExpired(KEY_PAIR_IS_NOT_BEFORE.webKeySet)).toBe(true);
    expect(isKeySetNotExpired(KEY_PAIR_IS_EXTERNAL.webKeySet)).toBe(true);
  });

  test("isKeyPrivate", () => {
    expect(isKeySetPrivate(KEY_PAIR_SIG_EC.webKeySet)).toBe(true);
    expect(isKeySetPrivate(KEY_PAIR_SIG_OCT.webKeySet)).toBe(true);
    expect(isKeySetPrivate(KEY_PAIR_SIG_OKP.webKeySet)).toBe(true);
    expect(isKeySetPrivate(KEY_PAIR_SIG_RSA.webKeySet)).toBe(true);
    expect(isKeySetPrivate(KEY_PAIR_IS_ENC.webKeySet)).toBe(false);
    expect(isKeySetPrivate(KEY_PAIR_IS_EXPIRED.webKeySet)).toBe(true);
    expect(isKeySetPrivate(KEY_PAIR_IS_NOT_BEFORE.webKeySet)).toBe(true);
    expect(isKeySetPrivate(KEY_PAIR_IS_EXTERNAL.webKeySet)).toBe(false);
  });

  test("isKeyPublic", () => {
    expect(isKeySetPublic(KEY_PAIR_SIG_EC.webKeySet)).toBe(true);
    expect(isKeySetPublic(KEY_PAIR_SIG_OCT.webKeySet)).toBe(false);
    expect(isKeySetPublic(KEY_PAIR_SIG_OKP.webKeySet)).toBe(true);
    expect(isKeySetPublic(KEY_PAIR_SIG_RSA.webKeySet)).toBe(true);
    expect(isKeySetPublic(KEY_PAIR_IS_ENC.webKeySet)).toBe(true);
    expect(isKeySetPublic(KEY_PAIR_IS_EXPIRED.webKeySet)).toBe(true);
    expect(isKeySetPublic(KEY_PAIR_IS_NOT_BEFORE.webKeySet)).toBe(true);
    expect(isKeySetPublic(KEY_PAIR_IS_EXTERNAL.webKeySet)).toBe(true);
  });
});
