import { calculateRetry as _calculateRetry } from "@lindorm/retry";
import { _requestWithRetry } from "./request-with-retry";
import { _sleep as __sleep } from "./sleep";

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
      },
    };

    fn = jest.fn().mockResolvedValue("response");

    calculateRetry.mockReturnValue(1000);
    sleep.mockResolvedValue(undefined);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(_requestWithRetry(fn, ctx)).resolves.toEqual("response");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("should retry", async () => {
    fn.mockRejectedValueOnce(new Error("message"));

    await expect(_requestWithRetry(fn, ctx)).resolves.toEqual("response");

    expect(sleep).toHaveBeenCalledWith(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
