import { formatTimestamp, sanitizeName, kebabToPascal } from "./migration-naming";
import { describe, expect, it } from "vitest";

describe("migration-naming", () => {
  describe("formatTimestamp", () => {
    it("should format date as YYYYMMDDHHMMSS", () => {
      const date = new Date("2026-02-23T14:30:45.000Z");
      expect(formatTimestamp(date)).toBe("20260223143045");
    });

    it("should zero-pad single-digit values", () => {
      const date = new Date("2026-01-02T03:04:05.000Z");
      expect(formatTimestamp(date)).toBe("20260102030405");
    });
  });

  describe("sanitizeName", () => {
    it("should lowercase and replace non-alphanumeric chars with hyphens", () => {
      expect(sanitizeName("Add Users Table")).toBe("add-users-table");
    });

    it("should collapse multiple hyphens", () => {
      expect(sanitizeName("add--users---table")).toBe("add-users-table");
    });

    it("should strip leading and trailing hyphens", () => {
      expect(sanitizeName("-add-users-")).toBe("add-users");
    });

    it("should return empty string for all-special input", () => {
      expect(sanitizeName("!!!")).toBe("");
    });
  });

  describe("kebabToPascal", () => {
    it("should convert kebab-case to PascalCase", () => {
      expect(kebabToPascal("add-users-table")).toBe("AddUsersTable");
    });

    it("should handle single word", () => {
      expect(kebabToPascal("init")).toBe("Init");
    });

    it("should handle empty string", () => {
      expect(kebabToPascal("")).toBe("");
    });
  });
});
