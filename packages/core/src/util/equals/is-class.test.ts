import { isClass } from "./is-class";

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

describe("isClass", () => {
  it("should resolve true", () => {
    expect(isClass(_class)).toBe(true);
  });

  it("should resolve false", () => {
    expect(isClass(_array)).toBe(false);
    expect(isClass(_boolean)).toBe(false);
    expect(isClass(_date)).toBe(false);
    expect(isClass(_error)).toBe(false);
    expect(isClass(_null)).toBe(false);
    expect(isClass(_number)).toBe(false);
    expect(isClass(_object)).toBe(false);
    expect(isClass(_string)).toBe(false);
    expect(isClass(_undefined)).toBe(false);
  });
});
