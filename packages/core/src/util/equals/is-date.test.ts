import { isDate } from "./is-date";

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

describe("isDate", () => {
  it("should resolve true", () => {
    expect(isDate(_date)).toBe(true);
  });

  it("should resolve false", () => {
    expect(isDate(_array)).toBe(false);
    expect(isDate(_boolean)).toBe(false);
    expect(isDate(_class)).toBe(false);
    expect(isDate(_error)).toBe(false);
    expect(isDate(_null)).toBe(false);
    expect(isDate(_number)).toBe(false);
    expect(isDate(_object)).toBe(false);
    expect(isDate(_string)).toBe(false);
    expect(isDate(_undefined)).toBe(false);
    expect(isDate(_url)).toBe(false);
  });
});
