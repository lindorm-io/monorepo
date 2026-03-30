import { composeAxiosConfig as _composeAxiosConfig } from "#internal/utils/compose-axios-config";
import { requestWithRetry as _requestWithRetry } from "#internal/utils/request-with-retry";
import { useAxios as _useAxios } from "#internal/utils/use-axios";
import { axiosRequestHandler } from "./axios-request-handler";

jest.mock("#internal/utils/compose-axios-config");
jest.mock("#internal/utils/request-with-retry");
jest.mock("#internal/utils/use-axios");

const composeAxiosConfig = _composeAxiosConfig as jest.Mock;
const requestWithRetry = _requestWithRetry as jest.Mock;
const useAxios = _useAxios as jest.Mock;

describe("axiosRequestHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = { req: "ctx" };

    composeAxiosConfig.mockResolvedValueOnce({ config: true });
    useAxios.mockResolvedValueOnce({ response: true });
    requestWithRetry.mockResolvedValueOnce({ response: true });
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(axiosRequestHandler(ctx, jest.fn())).resolves.toBeUndefined();

    expect(requestWithRetry).toHaveBeenCalledTimes(1);
    expect(requestWithRetry).toHaveBeenCalledWith(expect.any(Function), ctx);

    expect(ctx.res).toEqual({ response: true });
  });
});
