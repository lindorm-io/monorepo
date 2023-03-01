import { assertIdentifier } from "./assert-identifier";
import { IdentifierType } from "@lindorm-io/common-types";
import { randomUUID } from "crypto";

describe("assertIdentifier", () => {
  describe("email", () => {
    test("should resolve valid", async () => {
      await expect(
        assertIdentifier("test@lindorm.io", IdentifierType.EMAIL),
      ).resolves.toBeUndefined();
    });

    test("should throw invalid", async () => {
      await expect(assertIdentifier("wrong", IdentifierType.EMAIL)).rejects.toThrow();
    });
  });

  describe("external", () => {
    test("should resolve valid", async () => {
      await expect(
        assertIdentifier(randomUUID(), IdentifierType.EXTERNAL),
      ).resolves.toBeUndefined();
    });

    test("should throw invalid", async () => {
      await expect(assertIdentifier(123456, IdentifierType.EXTERNAL)).rejects.toThrow();
    });
  });

  describe("nin", () => {
    test("should resolve valid", async () => {
      await expect(assertIdentifier("202302240123", IdentifierType.NIN)).resolves.toBeUndefined();
    });

    test("should throw invalid", async () => {
      await expect(assertIdentifier("wrong", IdentifierType.NIN)).rejects.toThrow();
    });
  });

  describe("ssn", () => {
    test("should resolve valid", async () => {
      await expect(assertIdentifier("202302240123", IdentifierType.SSN)).resolves.toBeUndefined();
    });

    test("should throw invalid", async () => {
      await expect(assertIdentifier("wrong", IdentifierType.SSN)).rejects.toThrow();
    });
  });

  describe("phone", () => {
    test("should resolve valid", async () => {
      await expect(assertIdentifier("+46701234567", IdentifierType.PHONE)).resolves.toBeUndefined();
    });

    test("should throw invalid", async () => {
      await expect(assertIdentifier("wrong", IdentifierType.PHONE)).rejects.toThrow();
    });
  });

  describe("username", () => {
    test("should resolve valid", async () => {
      await expect(
        assertIdentifier("test_username-with.dot", IdentifierType.USERNAME),
      ).resolves.toBeUndefined();
    });

    test("should throw invalid", async () => {
      await expect(
        assertIdentifier("test!user%name&is(invalid", IdentifierType.USERNAME),
      ).rejects.toThrow();
    });
  });
});
