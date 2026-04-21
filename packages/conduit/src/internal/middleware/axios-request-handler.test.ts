import { composeAxiosConfig as _composeAxiosConfig } from "../utils/compose-axios-config";
import { requestWithRetry as _requestWithRetry } from "../utils/request-with-retry";
import { useAxios as _useAxios } from "../utils/use-axios";
import { axiosRequestHandler } from "./axios-request-handler";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../utils/compose-axios-config");
vi.mock("../utils/request-with-retry");
vi.mock("../utils/use-axios");

const composeAxiosConfig = _composeAxiosConfig as Mock;
const requestWithRetry = _requestWithRetry as Mock;
const useAxios = _useAxios as Mock;

describe("axiosRequestHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = { req: "ctx" };

    composeAxiosConfig.mockResolvedValueOnce({ config: true });
    useAxios.mockResolvedValueOnce({ response: true });
    requestWithRetry.mockResolvedValueOnce({ response: true });
  });

  afterEach(vi.resetAllMocks);

  test("should resolve", async () => {
    await expect(axiosRequestHandler(ctx, vi.fn())).resolves.toBeUndefined();

    expect(requestWithRetry).toHaveBeenCalledTimes(1);
    expect(requestWithRetry).toHaveBeenCalledWith(expect.any(Function), ctx);

    expect(ctx.res).toEqual({ response: true });
  });
});
