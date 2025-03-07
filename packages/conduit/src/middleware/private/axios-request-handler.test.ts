import {
  composeAxiosConfig as _composeAxiosConfig,
  requestWithRetry as _requestWithRetry,
  useAxios as _useAxios,
} from "../../utils/private";
import { axiosRequestHandler } from "./axios-request-handler";

jest.mock("../../utils/private");

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
