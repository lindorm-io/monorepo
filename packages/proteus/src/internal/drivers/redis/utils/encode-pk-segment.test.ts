import { decodePkSegment, encodePkSegment } from "./encode-pk-segment";

describe("encodePkSegment", () => {
  test("should pass through simple string", () => {
    expect(encodePkSegment("hello")).toMatchSnapshot();
  });

  test("should encode string containing colon", () => {
    expect(encodePkSegment("foo:bar")).toMatchSnapshot();
  });

  test("should encode string with multiple colons", () => {
    expect(encodePkSegment("a:b:c")).toMatchSnapshot();
  });

  test("should convert number to string", () => {
    expect(encodePkSegment(42)).toMatchSnapshot();
  });

  test("should convert boolean to string", () => {
    expect(encodePkSegment(true)).toMatchSnapshot();
  });

  test("should handle empty string", () => {
    expect(encodePkSegment("")).toMatchSnapshot();
  });

  test("should handle null", () => {
    expect(() => encodePkSegment(null)).toThrow(
      "PK segment value must not be null or undefined",
    );
  });

  test("should handle undefined", () => {
    expect(() => encodePkSegment(undefined)).toThrow(
      "PK segment value must not be null or undefined",
    );
  });

  test("should handle UUID without encoding (no colons)", () => {
    expect(encodePkSegment("550e8400-e29b-41d4-a716-446655440000")).toMatchSnapshot();
  });
});

describe("decodePkSegment", () => {
  test("should decode a simple string unchanged", () => {
    expect(decodePkSegment("hello")).toMatchSnapshot();
  });

  test("should decode an encoded colon", () => {
    expect(decodePkSegment("foo%3Abar")).toMatchSnapshot();
  });

  test("should round-trip a string with colons", () => {
    const original = "ns:entity:pk";
    const encoded = encodePkSegment(original);
    const decoded = decodePkSegment(encoded);
    expect(decoded).toBe(original);
  });

  test("should round-trip a string without colons", () => {
    const original = "simple-value";
    const encoded = encodePkSegment(original);
    const decoded = decodePkSegment(encoded);
    expect(decoded).toBe(original);
  });
});
