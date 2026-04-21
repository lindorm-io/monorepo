import { randomUUID } from "./random-uuid";
import { describe, expect, test } from "vitest";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomUUID", () => {
  test("should return a valid v4 uuid", () => {
    expect(randomUUID()).toMatch(UUID_REGEX);
  });

  test("should produce unique uuids", () => {
    expect(randomUUID()).not.toEqual(randomUUID());
  });
});
