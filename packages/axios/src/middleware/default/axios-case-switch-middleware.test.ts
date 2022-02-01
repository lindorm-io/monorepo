import { axiosCaseSwitchMiddleware } from "./axios-case-switch-middleware";

describe("axiosCaseSwitchMiddleware", () => {
  let middleware: any;

  beforeEach(() => {
    middleware = axiosCaseSwitchMiddleware;
  });

  test("should convert all data keys to snake_case", async () => {
    await expect(
      middleware.request({
        data: {
          camelCase1: 1,
          camelCase2: 2,
          camelCase3: { camelCase4: 4 },
        },
        headers: { headers: true },
        params: { params: true },
      }),
    ).resolves.toStrictEqual({
      data: {
        camel_case_1: 1,
        camel_case_2: 2,
        camel_case_3: {
          camel_case_4: 4,
        },
      },
      headers: {
        headers: true,
      },
      params: {
        params: true,
      },
    });
  });

  test("should convert all data keys to camelCase", async () => {
    await expect(
      middleware.response({
        data: {
          snake_case_1: 1,
          snake_case_2: 2,
          snake_case_3: { snake_case_4: 4 },
        },
        headers: {},
        status: 200,
        statusText: "OK",
      }),
    ).resolves.toStrictEqual({
      data: {
        snakeCase1: 1,
        snakeCase2: 2,
        snakeCase3: {
          snakeCase4: 4,
        },
      },
      headers: {},
      status: 200,
      statusText: "OK",
    });
  });
});
