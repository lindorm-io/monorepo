import { axiosRetryMiddleware } from "./axios-retry-middleware";

describe("axiosRetryMiddleware", () => {
  let middleware: any;

  beforeEach(() => {
    middleware = axiosRetryMiddleware;
  });

  test("should resolve true when error and options match", async () => {
    const error: any = { statusCode: 500 };
    const options: any = { retry: 1 };

    await expect(middleware.retry(error, options)).resolves.toBe(true);
  });

  test("should resolve false when status is not correct", async () => {
    const error: any = { statusCode: 400 };
    const options: any = { retry: 3 };

    await expect(middleware.retry(error, options)).resolves.toBe(false);
  });

  test("should resolve false when no more retries are allowed", async () => {
    const error: any = { statusCode: 500 };
    const options: any = { retry: 0 };

    await expect(middleware.retry(error, options)).resolves.toBe(false);
  });
});
