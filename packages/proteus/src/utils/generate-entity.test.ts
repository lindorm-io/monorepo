import { generateEntitySource } from "./generate-entity";
import { describe, expect, it } from "vitest";

describe("generateEntitySource", () => {
  it("produces a pascal-case entity file", () => {
    expect(generateEntitySource({ name: "User" })).toMatchSnapshot();
  });

  it("interpolates longer PascalCase names", () => {
    expect(generateEntitySource({ name: "UserProfile" })).toMatchSnapshot();
  });
});
