import { isUrlLike } from "./is-url-like";

class test {
  constructor() {}
}

const _array: any = ["array"];
const _boolean: any = true;
const _class: any = new test();
const _date: any = new Date();
const _error: any = new Error();
const _null: any = null;
const _number: any = 123456;
const _object: any = { object: true };
const _string: any = "string";
const _undefined: any = undefined;
const _url: any = new URL("https://test.lindorm.io");
const _url_string: any = "https://test.lindorm.io";

describe("isUrlLike", () => {
  it("should resolve true", () => {
    expect(isUrlLike(_url)).toBe(true);
  });

  it("should resolve true on url string", () => {
    expect(isUrlLike(_url_string)).toBe(true);
  });

  it("should resolve true on url string with base", () => {
    expect(isUrlLike("/path", _url_string)).toBe(true);
  });

  it("should resolve false", () => {
    expect(isUrlLike(_array)).toBe(false);
    expect(isUrlLike(_boolean)).toBe(false);
    expect(isUrlLike(_class)).toBe(false);
    expect(isUrlLike(_date)).toBe(false);
    expect(isUrlLike(_error)).toBe(false);
    expect(isUrlLike(_null)).toBe(false);
    expect(isUrlLike(_number)).toBe(false);
    expect(isUrlLike(_object)).toBe(false);
    expect(isUrlLike(_string)).toBe(false);
    expect(isUrlLike(_undefined)).toBe(false);
  });
});
