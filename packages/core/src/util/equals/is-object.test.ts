import { isObject } from "./is-object";

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

describe("isObject", () => {
  it("should resolve true on object", () => {
    expect(isObject(_object)).toBe(true);
  });

  it("should resolve false on everything else", () => {
    expect(isObject(_array)).toBe(false);
    expect(isObject(_boolean)).toBe(false);
    expect(isObject(_class)).toBe(false);
    expect(isObject(_date)).toBe(false);
    expect(isObject(_error)).toBe(false);
    expect(isObject(_null)).toBe(false);
    expect(isObject(_number)).toBe(false);
    expect(isObject(_string)).toBe(false);
    expect(isObject(_undefined)).toBe(false);
  });
});
