import { destructUrl } from "./destruct-url";

describe("destructUrl", () => {
  test("should resolve from URL", () => {
    expect(destructUrl(new URL("https://lindorm.io"))).toStrictEqual({
      host: "lindorm.io",
      pathname: "/",
      port: undefined,
      protocol: "https",
      query: {},
    });
  });

  test("should resolve from URL with port and path", () => {
    expect(destructUrl(new URL("https://lindorm.io:3000/test/path"))).toStrictEqual({
      host: "lindorm.io",
      pathname: "/test/path",
      port: 3000,
      protocol: "https",
      query: {},
    });
  });

  test("should resolve protocol and host from string", () => {
    expect(destructUrl("http://lindorm.io")).toStrictEqual({
      host: "lindorm.io",
      pathname: "/",
      port: undefined,
      protocol: "http",
      query: {},
    });
  });

  test("should resolve port from string", () => {
    expect(destructUrl("https://lindorm.io:4000")).toStrictEqual({
      host: "lindorm.io",
      pathname: "/",
      port: 4000,
      protocol: "https",
      query: {},
    });
  });

  test("should resolve from string without protocol", () => {
    expect(destructUrl("lindorm.io:4000")).toStrictEqual({
      host: "lindorm.io",
      pathname: "/",
      port: 4000,
      protocol: "https",
      query: {},
    });
  });

  test("should resolve from string without protocol or port", () => {
    expect(destructUrl("lindorm.io")).toStrictEqual({
      host: "lindorm.io",
      pathname: "/",
      port: undefined,
      protocol: "https",
      query: {},
    });
  });

  test("should resolve with query", () => {
    expect(destructUrl("https://lindorm.io?query_one=1&queryTwo=two")).toStrictEqual({
      host: "lindorm.io",
      pathname: "/",
      port: undefined,
      protocol: "https",
      query: {
        query_one: "1",
        queryTwo: "two",
      },
    });
  });

  test("should resolve from path", () => {
    expect(destructUrl("/test/path")).toStrictEqual({
      host: undefined,
      pathname: "/test/path",
      port: undefined,
      protocol: undefined,
      query: {},
    });
  });
});
