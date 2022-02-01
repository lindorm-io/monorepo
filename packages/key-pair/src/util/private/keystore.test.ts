import MockDate from "mockdate";
import { isKeyAllowed, isKeyExpired, isKeyPrivate, isKeyUsable } from "./keystore";
import {
  privateKey,
  privateKeyExternal,
  privateKeyRSA,
  privateKeyExpired,
  privateKeyExpires,
  privateKeyNotAllowed,
  publicKey,
  publicKeyExternal,
  publicKeyRSA,
  publicKeyExpired,
  publicKeyExpires,
  publicKeyNotAllowed,
} from "../../test";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("keystore", () => {
  describe("isKeyAllowed", () => {
    it("should resolve if key is expired", () => {
      expect(isKeyAllowed(privateKey)).toBe(true);
      expect(isKeyAllowed(privateKeyExternal)).toBe(true);
      expect(isKeyAllowed(privateKeyRSA)).toBe(true);
      expect(isKeyAllowed(privateKeyExpired)).toBe(true);
      expect(isKeyAllowed(privateKeyExpires)).toBe(true);
      expect(isKeyAllowed(privateKeyNotAllowed)).toBe(false);

      expect(isKeyAllowed(publicKey)).toBe(true);
      expect(isKeyAllowed(publicKeyExternal)).toBe(true);
      expect(isKeyAllowed(publicKeyRSA)).toBe(true);
      expect(isKeyAllowed(publicKeyExpired)).toBe(true);
      expect(isKeyAllowed(publicKeyExpires)).toBe(true);
      expect(isKeyAllowed(publicKeyNotAllowed)).toBe(false);
    });
  });

  describe("isKeyExpired", () => {
    it("should resolve if key is expired", () => {
      expect(isKeyExpired(privateKey)).toBe(false);
      expect(isKeyExpired(privateKeyExternal)).toBe(false);
      expect(isKeyExpired(privateKeyRSA)).toBe(false);
      expect(isKeyExpired(privateKeyExpired)).toBe(true);
      expect(isKeyExpired(privateKeyExpires)).toBe(false);
      expect(isKeyExpired(privateKeyNotAllowed)).toBe(false);

      expect(isKeyExpired(publicKey)).toBe(false);
      expect(isKeyExpired(publicKeyExternal)).toBe(false);
      expect(isKeyExpired(publicKeyRSA)).toBe(false);
      expect(isKeyExpired(publicKeyExpired)).toBe(true);
      expect(isKeyExpired(publicKeyExpires)).toBe(false);
      expect(isKeyExpired(publicKeyNotAllowed)).toBe(false);
    });
  });

  describe("isKeyPrivate", () => {
    it("should resolve if private key is a string", () => {
      expect(isKeyPrivate(privateKey)).toBe(true);
      expect(isKeyPrivate(privateKeyExternal)).toBe(true);
      expect(isKeyPrivate(privateKeyRSA)).toBe(true);
      expect(isKeyPrivate(privateKeyExpired)).toBe(true);
      expect(isKeyPrivate(privateKeyExpires)).toBe(true);
      expect(isKeyPrivate(privateKeyNotAllowed)).toBe(true);

      expect(isKeyPrivate(publicKey)).toBe(false);
      expect(isKeyPrivate(publicKeyExternal)).toBe(false);
      expect(isKeyPrivate(publicKeyRSA)).toBe(false);
      expect(isKeyPrivate(publicKeyExpired)).toBe(false);
      expect(isKeyPrivate(publicKeyExpires)).toBe(false);
      expect(isKeyPrivate(publicKeyNotAllowed)).toBe(false);
    });
  });

  describe("isKeyUsable", () => {
    it("should resolve if key is allowed and not expired", () => {
      expect(isKeyUsable(privateKey)).toBe(true);
      expect(isKeyUsable(privateKeyExternal)).toBe(true);
      expect(isKeyUsable(privateKeyRSA)).toBe(true);
      expect(isKeyUsable(privateKeyExpired)).toBe(false);
      expect(isKeyUsable(privateKeyExpires)).toBe(true);
      expect(isKeyUsable(privateKeyNotAllowed)).toBe(false);

      expect(isKeyUsable(publicKey)).toBe(true);
      expect(isKeyUsable(publicKeyExternal)).toBe(true);
      expect(isKeyUsable(publicKeyRSA)).toBe(true);
      expect(isKeyUsable(publicKeyExpired)).toBe(false);
      expect(isKeyUsable(publicKeyExpires)).toBe(true);
      expect(isKeyUsable(publicKeyNotAllowed)).toBe(false);
    });
  });
});
