import { axiosRequestHandler } from "./axios-request-handler";
import {
  composeAxiosConfig as _composeAxiosConfig,
  requestWithRetry as _requestWithRetry,
} from "../../util/private";

jest.mock("../../util/private");
jest.mock("@lindorm-io/retry");

const composeAxiosConfig = _composeAxiosConfig as jest.Mock;
const requestWithRetry = _requestWithRetry as jest.Mock;

describe("axiosRequestHandler", () => {
  let ctx: any;
  let next: any;

  beforeEach(() => {
    ctx = {
      req: {
        retry: { retry: true },
        retryCallback: "retryCallback",
      },
      res: {},
    };
    next = () => Promise.resolve();

    composeAxiosConfig.mockImplementation(() => ({ config: true }));
    requestWithRetry.mockResolvedValueOnce({ response: true });
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(axiosRequestHandler(ctx, next)).resolves.not.toThrow();

    expect(requestWithRetry).toHaveBeenCalledTimes(1);
    expect(composeAxiosConfig).toHaveBeenCalledTimes(1);

    expect(requestWithRetry).toHaveBeenCalledWith(
      { config: true },
      { retry: true },
      "retryCallback",
      1,
    );

    expect(ctx.res).toStrictEqual({ response: true });
  });
});
