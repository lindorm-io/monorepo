import { PG_IDENTIFIER_LIMIT } from "./postgres-constants";

describe("postgres-constants", () => {
  describe("PG_IDENTIFIER_LIMIT", () => {
    it("should be 63", () => {
      expect(PG_IDENTIFIER_LIMIT).toBe(63);
    });

    it("should match the PostgreSQL maximum identifier length", () => {
      // PostgreSQL truncates identifiers longer than 63 bytes
      expect(PG_IDENTIFIER_LIMIT).toMatchSnapshot();
    });

    it("should be a number", () => {
      expect(typeof PG_IDENTIFIER_LIMIT).toBe("number");
    });

    it("should be a positive integer", () => {
      expect(PG_IDENTIFIER_LIMIT).toBeGreaterThan(0);
      expect(Number.isInteger(PG_IDENTIFIER_LIMIT)).toBe(true);
    });
  });
});
