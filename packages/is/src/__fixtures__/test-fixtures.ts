class TestClass {
  constructor() {}
}

export const TEST_ARRAY: any = ["array"];
export const TEST_BOOLEAN: any = true;
export const TEST_CLASS: any = new TestClass();
export const TEST_DATE: any = new Date();
export const TEST_EMPTY_ARRAY: any = ["array"];
export const TEST_EMPTY_OBJECT: any = {};
export const TEST_EMPTY_STRING: any = "";
export const TEST_ERROR: any = new Error();
export const TEST_FINITE: any = 123456;
export const TEST_FUNCTION: any = () => {};
export const TEST_INFINITY: any = Infinity;
export const TEST_JWE: any =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0Lm9zcHJleS5ubyIsImlhdCI6MTYxNzQwNzQwMn0.eyJzdWIiOiJ0ZXN0Lm9zcHJleS5ubyIsImlhdCI6MTYxNzQwNzQwMn0.eyJzdWIiOiJ0ZXN0Lm9zcHJleS5ubyIsImlhdCI6MTYxNzQwNzQwMn0.1J9";
export const TEST_JWT: any =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0Lm9zcHJleS5ubyIsImlhdCI6MTYxNzQwNzQwMn0.1J9";
export const TEST_NAN: any = NaN;
export const TEST_NEGATIVE_INFINITY: any = -Infinity;
export const TEST_NULL: any = null;
export const TEST_NUMBER: any = 123456;
export const TEST_OBJECT: any = { object: true };
export const TEST_PROMISE: any = Promise.resolve();
export const TEST_STRING: any = "string";
export const TEST_UNDEFINED: any = undefined;
export const TEST_URL_STRING: any = "https://test.osprey.no";
export const TEST_URL: any = new URL(TEST_URL_STRING);

export const TEST_FIXTURES = {
  TEST_ARRAY,
  TEST_BOOLEAN,
  TEST_CLASS,
  TEST_DATE,
  TEST_EMPTY_ARRAY,
  TEST_EMPTY_OBJECT,
  TEST_EMPTY_STRING,
  TEST_ERROR,
  TEST_FINITE,
  TEST_FUNCTION,
  TEST_INFINITY,
  TEST_JWE,
  TEST_JWT,
  TEST_NAN,
  TEST_NEGATIVE_INFINITY,
  TEST_NULL,
  TEST_NUMBER,
  TEST_OBJECT,
  TEST_PROMISE,
  TEST_STRING,
  TEST_UNDEFINED,
  TEST_URL_STRING,
  TEST_URL,
};
