import { createBaseUrl } from "./create-base-url";

describe("createBaseUrl", () => {
  test("should resolve with host URL", () => {
    expect(
      createBaseUrl({
        host: new URL("https://test.lindorm.io:4000"),
      }).toString(),
    ).toEqual("https://test.lindorm.io:4000/");
  });

  test("should resolve with base URL", () => {
    expect(createBaseUrl({ base: new URL("https://test.lindorm.io:4000") }).toString()).toEqual(
      "https://test.lindorm.io:4000/",
    );
  });

  test("should resolve with host string and port", () => {
    expect(createBaseUrl({ host: "https://test.lindorm.io", port: 4000 }).toString()).toEqual(
      "https://test.lindorm.io:4000/",
    );
  });

  test("should resolve with host string", () => {
    expect(createBaseUrl({ host: "https://test.lindorm.io", port: 4000 }).toString()).toEqual(
      "https://test.lindorm.io:4000/",
    );
  });

  test("should resolve with base string and port", () => {
    expect(createBaseUrl({ base: "https://test.lindorm.io", port: 4000 }).toString()).toEqual(
      "https://test.lindorm.io:4000/",
    );
  });

  test("should resolve with base string", () => {
    expect(createBaseUrl({ base: "https://test.lindorm.io", port: 4000 }).toString()).toEqual(
      "https://test.lindorm.io:4000/",
    );
  });

  test("should prefer host", () => {
    expect(
      createBaseUrl({
        host: "https://host.lindorm.io",
        base: "https://base.lindorm.io",
      }).toString(),
    ).toEqual("https://host.lindorm.io/");
  });

  test("should skip port", () => {
    expect(
      createBaseUrl({
        host: "https://host.lindorm.io:4000",
        port: 3000,
      }).toString(),
    ).toEqual("https://host.lindorm.io:4000/");
  });

  test("should throw on missing options params", () => {
    expect(() => createBaseUrl({ port: 3000 }).toString()).toThrow();
  });

  test("should throw on invalid url strings", () => {
    expect(() => createBaseUrl({ host: "lindorm.io" }).toString()).toThrow();
  });
});
