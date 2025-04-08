import { calculateContentType, contentToBuffer, parseContent } from "./content";

describe("content", () => {
  describe("calculateContentType", () => {
    test("should resolve application/json", () => {
      expect(calculateContentType(["string"])).toEqual("application/json");
      expect(calculateContentType({ test: "data" })).toEqual("application/json");
      expect(calculateContentType(1)).toEqual("application/json");
    });

    test("should resolve application/octet-stream", () => {
      expect(calculateContentType(Buffer.from("test"))).toEqual(
        "application/octet-stream",
      );
    });

    test("should resolve text/plain", () => {
      expect(calculateContentType("test")).toEqual("text/plain");
    });

    test("should throw error", () => {
      expect(() => calculateContentType(undefined)).toThrow("Invalid content type");
      expect(() => calculateContentType(null)).toThrow("Invalid content type");
      expect(() => calculateContentType(true)).toThrow("Invalid content type");
    });
  });

  describe("contentToBuffer", () => {
    test("should resolve application/json", () => {
      expect(contentToBuffer({ test: "data" }, "application/json")).toEqual(
        Buffer.from(JSON.stringify({ test: "data" }), "utf8"),
      );
    });

    test("should resolve application/octet-stream", () => {
      expect(contentToBuffer(Buffer.from("test"), "application/octet-stream")).toEqual(
        Buffer.from("test"),
      );
    });

    test("should resolve text/plain", () => {
      expect(contentToBuffer("test", "text/plain")).toEqual(Buffer.from("test", "utf8"));
    });
  });

  describe("parseContent", () => {
    test("should parse application/json", () => {
      expect(
        parseContent(
          Buffer.from(JSON.stringify(["string", 123]), "utf8"),
          "application/json",
        ),
      ).toEqual(["string", 123]);
      expect(
        parseContent(
          Buffer.from(JSON.stringify({ test: "data" }), "utf8"),
          "application/json",
        ),
      ).toEqual({ test: "data" });
      expect(
        parseContent(Buffer.from(JSON.stringify(123456789), "utf8"), "application/json"),
      ).toEqual(123456789);
    });

    test("should parse application/octet-stream", () => {
      expect(parseContent(Buffer.from("test"), "application/octet-stream")).toEqual(
        Buffer.from("test"),
      );
    });

    test("should parse text/plain", () => {
      expect(parseContent(Buffer.from("test", "utf8"), "text/plain")).toEqual("test");
    });

    test("should parse text/plain by default", () => {
      expect(parseContent(Buffer.from("test", "utf8"))).toEqual("test");
    });
  });
});
