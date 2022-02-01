import { isArrayStrict, isObjectStrict } from "./strict-type";

const _array: any = ["array"];
const _boolean: any = true;
const _date: any = new Date();
const _error: any = new Error();
const _null: any = null;
const _number: any = 123456;
const _object: any = { object: true };
const _string: any = "string";
const _undefined: any = undefined;

describe("isArrayStrict", () => {
  it("should resolve true on array", () => {
    expect(isArrayStrict(_array)).toBe(true);
  });

  it("should resolve false on everything else", () => {
    expect(isArrayStrict(_boolean)).toBe(false);
    expect(isArrayStrict(_date)).toBe(false);
    expect(isArrayStrict(_error)).toBe(false);
    expect(isArrayStrict(_null)).toBe(false);
    expect(isArrayStrict(_number)).toBe(false);
    expect(isArrayStrict(_object)).toBe(false);
    expect(isArrayStrict(_string)).toBe(false);
    expect(isArrayStrict(_undefined)).toBe(false);
  });
});

describe("isObjectStrict", () => {
  it("should resolve true on array", () => {
    expect(isObjectStrict(_object)).toBe(true);
  });

  it("should resolve false on everything else", () => {
    expect(isObjectStrict(_array)).toBe(false);
    expect(isObjectStrict(_boolean)).toBe(false);
    expect(isObjectStrict(_date)).toBe(false);
    expect(isObjectStrict(_error)).toBe(false);
    expect(isObjectStrict(_null)).toBe(false);
    expect(isObjectStrict(_number)).toBe(false);
    expect(isObjectStrict(_string)).toBe(false);
    expect(isObjectStrict(_undefined)).toBe(false);
  });
});
