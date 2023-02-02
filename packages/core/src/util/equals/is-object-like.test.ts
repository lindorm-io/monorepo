import { isObjectLike } from "./is-object-like";

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

describe("isObjectLike", () => {
  it("should resolve true on object", () => {
    expect(isObjectLike(_object)).toBe(true);
  });

  it("should resolve true on class", () => {
    expect(isObjectLike(_class)).toBe(true);
  });

  it("should resolve true on date", () => {
    expect(isObjectLike(_date)).toBe(true);
  });

  it("should resolve true on error", () => {
    expect(isObjectLike(_error)).toBe(true);
  });

  it("should resolve false on everything else", () => {
    expect(isObjectLike(_array)).toBe(false);
    expect(isObjectLike(_boolean)).toBe(false);
    expect(isObjectLike(_null)).toBe(false);
    expect(isObjectLike(_number)).toBe(false);
    expect(isObjectLike(_string)).toBe(false);
    expect(isObjectLike(_undefined)).toBe(false);
  });
});
