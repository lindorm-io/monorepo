import { isNumber } from "./is-number";

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

describe("isNumber", () => {
  it("should resolve true", () => {
    expect(isNumber(_number)).toBe(true);
  });

  it("should resolve false", () => {
    expect(isNumber(_array)).toBe(false);
    expect(isNumber(_boolean)).toBe(false);
    expect(isNumber(_class)).toBe(false);
    expect(isNumber(_date)).toBe(false);
    expect(isNumber(_error)).toBe(false);
    expect(isNumber(_null)).toBe(false);
    expect(isNumber(_object)).toBe(false);
    expect(isNumber(_string)).toBe(false);
    expect(isNumber(_undefined)).toBe(false);
  });
});
