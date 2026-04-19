import { expiresAt } from "@lindorm/date";
import { ServerError } from "@lindorm/errors";
import { assertSecurityTxtOptions } from "./assert-security-txt-options";

describe("assertSecurityTxtOptions", () => {
  const futureExpires = (): Date => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  };

  describe("contact validation", () => {
    test("should throw when contact is an empty string", () => {
      expect(() =>
        assertSecurityTxtOptions({
          contact: "",
          expires: futureExpires(),
        }),
      ).toThrow(ServerError);
    });

    test("should throw when contact is a whitespace-only string", () => {
      expect(() =>
        assertSecurityTxtOptions({
          contact: "   ",
          expires: futureExpires(),
        }),
      ).toThrow(ServerError);
    });

    test("should throw when contact is an empty array", () => {
      expect(() =>
        assertSecurityTxtOptions({
          contact: [],
          expires: futureExpires(),
        }),
      ).toThrow(ServerError);
    });

    test("should throw when contact array contains an empty string", () => {
      expect(() =>
        assertSecurityTxtOptions({
          contact: ["mailto:security@example.com", ""],
          expires: futureExpires(),
        }),
      ).toThrow(ServerError);
    });

    test("should include 'contact' in the error message", () => {
      expect(() =>
        assertSecurityTxtOptions({
          contact: "",
          expires: futureExpires(),
        }),
      ).toThrow(/contact/);
    });
  });

  describe("expires validation", () => {
    test("should throw when expires is an unparseable string", () => {
      expect(() =>
        assertSecurityTxtOptions({
          contact: "mailto:security@example.com",
          expires: "not-a-date",
        }),
      ).toThrow(ServerError);
    });

    test("should throw when expires is in the past", () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);

      expect(() =>
        assertSecurityTxtOptions({
          contact: "mailto:security@example.com",
          expires: past,
        }),
      ).toThrow(/past/);
    });

    test("should throw when expires is more than 1 year in the future", () => {
      const farFuture = expiresAt("2Years");

      expect(() =>
        assertSecurityTxtOptions({
          contact: "mailto:security@example.com",
          expires: farFuture,
        }),
      ).toThrow(/1 year/);
    });

    test("should include 'expires' in the error message", () => {
      expect(() =>
        assertSecurityTxtOptions({
          contact: "mailto:security@example.com",
          expires: "not-a-date",
        }),
      ).toThrow(/expires/);
    });
  });

  describe("happy path", () => {
    test("should not throw for a valid Date expires", () => {
      expect(() =>
        assertSecurityTxtOptions({
          contact: "mailto:security@example.com",
          expires: futureExpires(),
        }),
      ).not.toThrow();
    });

    test("should not throw for a valid ISO string expires", () => {
      const future = futureExpires().toISOString();

      expect(() =>
        assertSecurityTxtOptions({
          contact: "mailto:security@example.com",
          expires: future,
        }),
      ).not.toThrow();
    });

    test("should not throw for an array of contacts", () => {
      expect(() =>
        assertSecurityTxtOptions({
          contact: ["mailto:security@example.com", "https://example.com/contact"],
          expires: futureExpires(),
        }),
      ).not.toThrow();
    });
  });
});
