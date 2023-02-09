import { isString } from "./is-string";

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

describe("isString", () => {
  it("should resolve true", () => {
    expect(isString(_string)).toBe(true);
  });

  it("should resolve false", () => {
    expect(isString(_array)).toBe(false);
    expect(isString(_boolean)).toBe(false);
    expect(isString(_class)).toBe(false);
    expect(isString(_date)).toBe(false);
    expect(isString(_error)).toBe(false);
    expect(isString(_null)).toBe(false);
    expect(isString(_number)).toBe(false);
    expect(isString(_object)).toBe(false);
    expect(isString(_undefined)).toBe(false);
  });
});
