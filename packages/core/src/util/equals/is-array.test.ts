import { isArray } from "./is-array";

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

describe("isArray", () => {
  it("should resolve true", () => {
    expect(isArray(_array)).toBe(true);
  });

  it("should resolve false", () => {
    expect(isArray(_boolean)).toBe(false);
    expect(isArray(_class)).toBe(false);
    expect(isArray(_date)).toBe(false);
    expect(isArray(_error)).toBe(false);
    expect(isArray(_null)).toBe(false);
    expect(isArray(_number)).toBe(false);
    expect(isArray(_object)).toBe(false);
    expect(isArray(_string)).toBe(false);
    expect(isArray(_undefined)).toBe(false);
  });
});
