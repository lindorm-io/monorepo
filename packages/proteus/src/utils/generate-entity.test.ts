import { generateEntitySource } from "./generate-entity";

describe("generateEntitySource", () => {
  it("produces a pascal-case entity file", () => {
    expect(generateEntitySource({ name: "User" })).toMatchSnapshot();
  });

  it("interpolates longer PascalCase names", () => {
    expect(generateEntitySource({ name: "UserProfile" })).toMatchSnapshot();
  });
});
