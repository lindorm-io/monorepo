import { createURL } from "./url";

describe("createURL", () => {
  test("should resolve instance of URL", () => {
    expect(createURL("https://lindorm.io/test")).toBeInstanceOf(URL);
  });

  test("should accept URL as primary arg", () => {
    expect(createURL(new URL("https://lindorm.io/test")).toString()).toBe(
      "https://lindorm.io/test",
    );
  });

  test("should add baseUrl to path", () => {
    expect(
      createURL("/test", {
        baseUrl: "https://lindorm.io",
      }).toString(),
    ).toBe("https://lindorm.io/test");
  });

  test("should add basePort to path", () => {
    expect(
      createURL("/test", {
        basePort: 3000,
        baseUrl: "https://lindorm.io",
      }).toString(),
    ).toBe("https://lindorm.io:3000/test");
  });

  test("should add params to path", () => {
    expect(
      createURL(
        "https://lindorm.io/one/:paramOne/two/:paramTwo/three/:paramThree/four/:paramFour/five/:paramFive",
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
      "https://lindorm.io/one/string/two/123456/three/true/four/string%20with%20spaces/five/array%20987%20false",
    );
  });

  test("should add query to path", () => {
    expect(
      createURL("https://lindorm.io", {
        query: {
          queryOne: "string",
          queryTwo: 123456,
          queryThree: true,
          queryFour: "string with spaces",
          queryFive: ["array", 987, false],
        },
      }).toString(),
    ).toBe(
      "https://lindorm.io/?query_one=string&query_two=123456&query_three=true&query_four=string+with+spaces&query_five=array+987+false",
    );
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
    ).toBe("https://lindorm.io/test/one/two?query_one=string&query_two=123456");
  });

  test("should throw on URL/baseUrl conflict", () => {
    expect(() => createURL(new URL("https://lindorm.io/test"), { baseUrl: "url" })).toThrow(Error);
  });

  test("should throw on basePort/baseUrl conflict", () => {
    expect(() => createURL("/pathname", { basePort: 4000 })).toThrow(Error);
  });
});
