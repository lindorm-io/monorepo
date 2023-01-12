import { createURL } from "./create-url";

describe("createURL", () => {
  test("should resolve instance of URL", () => {
    expect(createURL("https://lindorm.io/test")).toBeInstanceOf(URL);
  });

  test("should accept URL as primary arg", () => {
    expect(createURL(new URL("https://lindorm.io/test")).toString()).toBe(
      "https://lindorm.io/test",
    );
  });

  test("should add host to path", () => {
    expect(
      createURL("/test", {
        host: "https://lindorm.io",
      }).toString(),
    ).toBe("https://lindorm.io/test");
  });

  test("should add host and protocol to path", () => {
    expect(
      createURL("/test", {
        host: "lindorm.io",
        protocol: "https",
      }).toString(),
    ).toBe("https://lindorm.io/test");
  });

  test("should add port to path", () => {
    expect(
      createURL("/test", {
        host: "https://lindorm.io",
        port: 3000,
      }).toString(),
    ).toBe("https://lindorm.io:3000/test");
  });

  test("should use default protocol", () => {
    expect(
      createURL("/test", {
        host: "lindorm.io",
      }).toString(),
    ).toBe("https://lindorm.io/test");
  });

  test("should add params to path", () => {
    expect(
      createURL(
        "https://lindorm.io:4000/one/:paramOne/two/:paramTwo/three/:paramThree/four/:paramFour/five/:paramFive",
        {
          params: {
            paramOne: "string",
            paramTwo: 123456,
            paramThree: true,
            paramFour: "string with spaces",
            paramFive: ["array", 987, false],
          },
        },
      ).toString(),
    ).toBe(
      "https://lindorm.io:4000/one/string/two/123456/three/true/four/string%20with%20spaces/five/array%20987%20false",
    );
  });

  test("should add digit param to path", () => {
    expect(
      createURL("https://lindorm.io/one/:1", {
        params: {
          "1": "two",
        },
      }).toString(),
    ).toBe("https://lindorm.io/one/two");
  });

  test("should add query to URL path and transform", () => {
    expect(
      createURL(new URL("https://lindorm.io/url/path"), {
        query: {
          queryOne: "string",
          queryTwo: 123456,
          queryThree: true,
          queryFour: "string with spaces",
          queryFive: ["array", 987, false],
        },
        queryCaseTransform: "snake",
      }).toString(),
    ).toBe(
      "https://lindorm.io/url/path?query_one=string&query_two=123456&query_three=true&query_four=string+with+spaces&query_five=array+987+false",
    );
  });

  test("should add query to string path", () => {
    expect(
      createURL("https://lindorm.io", {
        query: {
          query_one: "string",
          query_two: 123456,
          query_three: true,
          query_four: "string with spaces",
          query_five: ["array", 987, false],
        },
      }).toString(),
    ).toBe(
      "https://lindorm.io/?query_one=string&query_two=123456&query_three=true&query_four=string+with+spaces&query_five=array+987+false",
    );
  });

  test("should transform query to camel", () => {
    expect(
      createURL("https://lindorm.io", {
        query: {
          QueryOne: "string",
        },
        queryCaseTransform: "camel",
      }).toString(),
    ).toBe("https://lindorm.io/?queryOne=string");
  });

  test("should transform query to kebab", () => {
    expect(
      createURL("https://lindorm.io", {
        query: {
          QueryOne: "string",
        },
        queryCaseTransform: "kebab",
      }).toString(),
    ).toBe("https://lindorm.io/?query-one=string");
  });

  test("should transform query to pascal", () => {
    expect(
      createURL("https://lindorm.io", {
        query: {
          queryOne: "string",
        },
        queryCaseTransform: "pascal",
      }).toString(),
    ).toBe("https://lindorm.io/?QueryOne=string");
  });

  test("should transform query to snake", () => {
    expect(
      createURL("https://lindorm.io", {
        query: {
          queryOne: "string",
        },
        queryCaseTransform: "snake",
      }).toString(),
    ).toBe("https://lindorm.io/?query_one=string");
  });

  test("should keep current path", () => {
    expect(
      createURL("https://lindorm.io/test/:one/two?query_one=string", {
        params: {
          one: "one",
        },
        query: {
          queryTwo: 123456,
        },
      }).toString(),
    ).toBe("https://lindorm.io/test/one/two?query_one=string&queryTwo=123456");
  });
});
