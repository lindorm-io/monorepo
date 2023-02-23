import { isUrl } from "./is-url";

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

describe("isUrl", () => {
  it("should resolve true", () => {
    expect(isUrl(_url)).toBe(true);
  });

  it("should resolve false", () => {
    expect(isUrl(_array)).toBe(false);
    expect(isUrl(_boolean)).toBe(false);
    expect(isUrl(_class)).toBe(false);
    expect(isUrl(_date)).toBe(false);
    expect(isUrl(_error)).toBe(false);
    expect(isUrl(_null)).toBe(false);
    expect(isUrl(_number)).toBe(false);
    expect(isUrl(_object)).toBe(false);
    expect(isUrl(_string)).toBe(false);
    expect(isUrl(_undefined)).toBe(false);
  });
});
