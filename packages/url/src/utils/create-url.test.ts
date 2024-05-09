import { ChangeCase } from "@lindorm/case";
import { createUrl } from "./create-url";

describe("createUrl", () => {
  test("should resolve instance of URL", () => {
    expect(createUrl("https://lindorm.io/test")).toBeInstanceOf(URL);
  });

  test("should accept URL as primary arg", () => {
    expect(createUrl(new URL("https://lindorm.io/test")).toString()).toEqual(
      "https://lindorm.io/test",
    );
  });

  test("should accept URL string as primary arg", () => {
    expect(createUrl("https://lindorm.io/test").toString()).toEqual("https://lindorm.io/test");
  });

  test("should use host", () => {
    expect(
      createUrl("/path", {
        host: "https://lindorm.io",
      }).toString(),
    ).toEqual("https://lindorm.io/path");
  });

  test("should use baseURL", () => {
    expect(createUrl("/path", { baseUrl: "https://lindorm.io" }).toString()).toEqual(
      "https://lindorm.io/path",
    );
  });

  test("should use host with port", () => {
    expect(createUrl("/test", { host: "https://lindorm.io:3000" }).toString()).toEqual(
      "https://lindorm.io:3000/test",
    );
  });

  test("should use host and port from options", () => {
    expect(createUrl("/path", { host: "https://lindorm.io", port: 3000 }).toString()).toEqual(
      "https://lindorm.io:3000/path",
    );
  });

  test("should add existing query", () => {
    expect(
      createUrl("/path", { host: "https://lindorm.io?testCamel=one&hello_snake=two" }).toString(),
    ).toEqual("https://lindorm.io/path?testCamel=one&hello_snake=two");
  });

  test("should add existing path", () => {
    expect(createUrl("/path", { host: "https://lindorm.io/test" }).toString()).toEqual(
      "https://lindorm.io/test/path",
    );
  });

  test("should add params to path", () => {
    expect(
      createUrl(
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
    ).toEqual(
      "https://lindorm.io:4000/one/string/two/123456/three/true/four/string%20with%20spaces/five/array%20987%20false",
    );
  });

  test("should add digit param to path", () => {
    expect(
      createUrl("https://lindorm.io/one/:1", {
        params: {
          "1": "two",
        },
      }).toString(),
    ).toEqual("https://lindorm.io/one/two");
  });

  test("should add query to URL path and transform", () => {
    expect(
      createUrl(new URL("https://lindorm.io/url/path"), {
        query: {
          queryOne: "string",
          queryTwo: 123456,
          queryThree: true,
          queryFour: "string with spaces",
          queryFive: ["array", 987, false],
        },
        changeQueryCase: ChangeCase.Snake,
      }).toString(),
    ).toEqual(
      "https://lindorm.io/url/path?query_one=string&query_two=123456&query_three=true&query_four=string+with+spaces&query_five=array+987+false",
    );
  });

  test("should add query to string path", () => {
    expect(
      createUrl("https://lindorm.io", {
        query: {
          query_one: "string",
          query_two: 123456,
          query_three: true,
          query_four: "string with spaces",
          query_five: ["array", 987, false],
        },
      }).toString(),
    ).toEqual(
      "https://lindorm.io/?query_one=string&query_two=123456&query_three=true&query_four=string+with+spaces&query_five=array+987+false",
    );
  });

  test("should transform query to camel", () => {
    expect(
      createUrl("https://lindorm.io", {
        query: {
          QueryOne: "string",
        },
        changeQueryCase: ChangeCase.Camel,
      }).toString(),
    ).toEqual("https://lindorm.io/?queryOne=string");
  });
});
