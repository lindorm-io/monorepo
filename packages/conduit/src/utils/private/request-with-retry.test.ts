import { calculateRetry as _calculateRetry } from "@lindorm/retry";
import { requestWithRetry } from "./request-with-retry";
import { sleep as __sleep } from "./sleep";

jest.mock("@lindorm/retry");
jest.mock("./sleep");

const calculateRetry = _calculateRetry as jest.Mock;
const sleep = __sleep as jest.Mock;

describe("requestWithRetry", () => {
  let ctx: any;
  let fn: any;

  beforeEach(() => {
    ctx = {
      req: {
        retryOptions: { options: true },
        retryCallback: () => true,
        signal: undefined,
      },
    };

    fn = jest.fn().mockResolvedValue("response");

    calculateRetry.mockReturnValue(1000);
    sleep.mockResolvedValue(undefined);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(requestWithRetry(fn, ctx)).resolves.toEqual("response");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("should retry", async () => {
    fn.mockRejectedValueOnce(new Error("message"));

    await expect(requestWithRetry(fn, ctx)).resolves.toEqual("response");

    expect(sleep).toHaveBeenCalledWith(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("should enforce hard ceiling of 100 attempts", async () => {
    // Mock callback to always return true (retry forever)
    ctx.req.retryCallback = jest.fn().mockReturnValue(true);

    // Mock fn to always fail
    fn.mockRejectedValue(new Error("persistent failure"));

    await expect(requestWithRetry(fn, ctx)).rejects.toThrow("persistent failure");

    // Should stop at 100 attempts, not continue infinitely
    expect(fn).toHaveBeenCalledTimes(100);
    expect(ctx.req.retryCallback).toHaveBeenCalledTimes(99); // Callback checked 99 times (not on attempt 100)
  });

  test("should stop retrying when signal is aborted", async () => {
    const controller = new AbortController();
    ctx.req.signal = controller.signal;
    ctx.req.retryCallback = jest.fn().mockReturnValue(true);

    // First call fails, then abort the signal before retry
    fn.mockRejectedValueOnce(new Error("first failure")).mockResolvedValue("success");

    // Abort the signal after first failure
    controller.abort();

    await expect(requestWithRetry(fn, ctx)).rejects.toThrow("first failure");

    // Should not retry after signal is aborted
    expect(fn).toHaveBeenCalledTimes(1);
    expect(ctx.req.retryCallback).not.toHaveBeenCalled();
  });

  test("should continue retrying if signal is not aborted", async () => {
    const controller = new AbortController();
    ctx.req.signal = controller.signal;

    fn.mockRejectedValueOnce(new Error("failure")).mockResolvedValue("success");

    await expect(requestWithRetry(fn, ctx)).resolves.toEqual("success");

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
