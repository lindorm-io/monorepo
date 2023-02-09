import { isError } from "./is-error";

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

describe("isError", () => {
  it("should resolve true", () => {
    expect(isError(_error)).toBe(true);
  });

  it("should resolve false", () => {
    expect(isError(_array)).toBe(false);
    expect(isError(_boolean)).toBe(false);
    expect(isError(_class)).toBe(false);
    expect(isError(_date)).toBe(false);
    expect(isError(_null)).toBe(false);
    expect(isError(_number)).toBe(false);
    expect(isError(_object)).toBe(false);
    expect(isError(_string)).toBe(false);
    expect(isError(_undefined)).toBe(false);
  });
});
