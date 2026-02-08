class TestClass {
  constructor() {}
}

export const TEST_ARRAY: any = ["array"];
export const TEST_BIGINT: any = BigInt("9007199254740993");
export const TEST_BOOLEAN_STRING: any = "false";
export const TEST_BOOLEAN: any = true;
export const TEST_BUFFER: any = Buffer.from("test", "utf8");
export const TEST_CLASS: any = new TestClass();
export const TEST_DATE_STRING: any = new Date().toISOString();
export const TEST_DATE: any = new Date();
export const TEST_EMPTY_ARRAY: any = ["array"];
export const TEST_EMPTY_OBJECT: any = {};
export const TEST_EMPTY_STRING: any = "";
export const TEST_ERROR: any = new Error();
export const TEST_FINITE: any = 123456;
export const TEST_FUNCTION: any = () => {};
export const TEST_INFINITY: any = Infinity;
export const TEST_JWE: any =
  "eyJhbGciOiJFQ0RILUVTIiwiY3JpdCI6WyJhbGciLCJlbmMiLCJlcGsiLCJoa2RmX3NhbHQiXSwiY3R5IjoiSldTIiwiZW5jIjoiQTI1NkdDTSIsImVwayI6eyJjcnYiOiJYMjU1MTkiLCJrdHkiOiJPS1AiLCJ4IjoiLXRRQXJYeXdTZmtrY0RjLW9DTTdLQ2RZS3psTHRLcUNuR09KZjlVeUpXYyJ9LCJoa2RmX3NhbHQiOiJzdC9KcW9UUlFBbnJQbnVSVnZrRjJnPT0iLCJqa3UiOiJodHRwczovL3Rlc3QubGluZG9ybS5pby8ud2VsbC1rbm93bi9qd2tzLmpzb24iLCJraWQiOiIwMzVmN2YwMC04MTAxLTUzODctYTkzNS1lOTJmNTczNDczMDkiLCJvaWQiOiIzMzEwMDM3My05NzY5LTQzODktOTRkZC0xYjFkNzM4ZjBmYzQiLCJ0eXAiOiJKV0UifQ..1sFlVmtPaeJveO4S.3K-6_jJleFAGs-ceURDlA9uuyxI3mZkSGHzywFF1Pl8iXsaot70iK_XtQx_6G1mIR-45SgSPU5_apTWrasd7hmGYvVTmfWw72ZQQjZvW71oxzwJES28lz0l82dwzv5wZmDQNo9erRtY0l1lVe8Qo7CATbUC7KX9wfph27k1GJYhJ4PbOhvi5mI2pQ9cTUn9Dw9hBUUROaL9o6Jy1MCJ24g7ZxmxHEH47U2cwGaNmQQ_xf5hVSezEPn6LKGtGSQ21GQMauVeVhfMWanCCayCeItugi6ptWMl-_40ezPcJ8w1AZJ6_UUpPymNFPYLZraNFdzlMoPOPLM6QfNk5AHS6YYMYg19-UgZELQp3ye8qT9sinozJufNvs5MlNaGRNxbkMNFF0njo7-CBhD85LzGyNkUjgtwunQjVYWZG94svO_JBfEwbVxaCvdy6wD5YIGhTM-xI0syUyiyOYfDu65C3afN7cfk3yGA3DcvdXtjvZ3q5-uqa9TdgCixw5sDotAMYYPfka0qnFuEIpgSw-GNIhMHiQHqjYzydumVnKrMcG5gQLVUI-wRQdWYaFbLOUl2OosSSnai-.Cu9rRE7HMzOGqqMGlYCp5A";
export const TEST_JWS: any =
  "eyJhbGciOiJFUzUxMiIsImN0eSI6InRleHQvcGxhaW4iLCJqa3UiOiJodHRwczovL3Rlc3QubGluZG9ybS5pby8ud2VsbC1rbm93bi9qd2tzLmpzb24iLCJraWQiOiJiOWU3YmI0ZC1kMzMyLTU1ZDItOWIzMy1mOTkwZmY3ZGI0YzciLCJvaWQiOiIwOTE3MmZhYi1kYmZmLTQwZWYtYmI4Ni05NGQ5ZDRlZDM3ZGMiLCJ0eXAiOiJKV1MifQ.ZGF0YQ.AR1R7suSdJ39F0Pp22r8-P91OgnW-UxupXBfZelvAktr5qUCrXS2tPlMzLQhOCY5Bf9jSB7FN2vC06vTqQeJhDhvARQMMbsN72YvaLE8SdFVSXuvhrCyN3eqMiDXCwfXEidtlIlJwZkaEQY8tcebm9wKuqUBWG1Z1xJpJfSSsmmIGWnH";
export const TEST_JWT: any =
  "eyJhbGciOiJFUzUxMiIsImN0eSI6ImFwcGxpY2F0aW9uL2pzb24iLCJqa3UiOiJodHRwczovL3Rlc3QubGluZG9ybS5pby8ud2VsbC1rbm93bi9qd2tzLmpzb24iLCJraWQiOiJiOWU3YmI0ZC1kMzMyLTU1ZDItOWIzMy1mOTkwZmY3ZGI0YzciLCJvaWQiOiIzZjJhZTc5ZC1mMWQxLTU1NmItYThiYy0zMDVlNmIyMzM0YWQiLCJ0eXAiOiJKV1QifQ.eyJleHAiOjE3MDQwOTk2MDAsImlhdCI6MTcwNDA5NjAwMCwiaXNzIjoiaHR0cHM6Ly90ZXN0LmxpbmRvcm0uaW8vIiwianRpIjoiMmNjYzFhNTctNzJmMi00NjY1LWFmNDktMmExNGQ3OTU2NGI5IiwibmJmIjoxNzA0MDk2MDAwLCJzdWIiOiIzZjJhZTc5ZC1mMWQxLTU1NmItYThiYy0zMDVlNmIyMzM0YWQiLCJ0b2tlbl90eXBlIjoidGVzdF90b2tlbiJ9.AC8K2lM5CdEmR87vWLWodhA4B7xGmhHIvoQ2YXZUCnTPiFEwLsoHjQCUySgu7pHBBFEFgRrtie5Ho0gWfVk6NwYfAepqi-DT1vmsO_zx2UGEgmlZr3T9YS-yb6AredTqYIJYoLHxcuwvLWnb_8wTYR1pIrTMbLK-MBtr_jdX7AbVOkuf";
export const TEST_NAN: any = NaN;
export const TEST_NEGATIVE_INFINITY: any = -Infinity;
export const TEST_NEGATIVE_NUMBER_STRING: any = "-123456";
export const TEST_NEGATIVE_NUMBER: any = -256;
export const TEST_NULL: any = null;
export const TEST_NUMBER_STRING: any = "123456";
export const TEST_NUMBER: any = 123456;
export const TEST_OBJECT: any = { object: true };
export const TEST_PROMISE: any = Promise.resolve();
export const TEST_STRING: any = "string";
export const TEST_UNDEFINED: any = undefined;
export const TEST_URL_STRING: any = "https://test.osprey.no";
export const TEST_URL: any = new URL(TEST_URL_STRING);

export const TEST_FIXTURES = {
  TEST_ARRAY,
  TEST_BIGINT,
  TEST_BOOLEAN_STRING,
  TEST_BOOLEAN,
  TEST_BUFFER,
  TEST_CLASS,
  TEST_DATE_STRING,
  TEST_DATE,
  TEST_EMPTY_ARRAY,
  TEST_EMPTY_OBJECT,
  TEST_EMPTY_STRING,
  TEST_ERROR,
  TEST_FINITE,
  TEST_FUNCTION,
  TEST_INFINITY,
  TEST_JWE,
  TEST_JWS,
  TEST_JWT,
  TEST_NAN,
  TEST_NEGATIVE_INFINITY,
  TEST_NEGATIVE_NUMBER_STRING,
  TEST_NEGATIVE_NUMBER,
  TEST_NULL,
  TEST_NUMBER_STRING,
  TEST_NUMBER,
  TEST_OBJECT,
  TEST_PROMISE,
  TEST_STRING,
  TEST_UNDEFINED,
  TEST_URL_STRING,
  TEST_URL,
};
