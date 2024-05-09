import { _composeAxiosConfig } from "../../utils/private/compose-axios-config";
import { _requestWithRetry } from "../../utils/private/request-with-retry";
import { _axiosRequestHandler } from "./axios-request-handler";

jest.mock("axios");
jest.mock("../../utils/private/compose-axios-config");
jest.mock("../../utils/private/request-with-retry");

const composeAxiosConfig = _composeAxiosConfig as jest.Mock;
const requestWithRetry = _requestWithRetry as jest.Mock;

describe("axiosRequestHandler", () => {
  let ctx: any;
  let next: any;

  beforeEach(() => {
    ctx = { req: "ctx" };
    next = () => Promise.resolve();

    composeAxiosConfig.mockResolvedValueOnce({ config: true });
    requestWithRetry.mockResolvedValueOnce({ response: true });
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(_axiosRequestHandler(ctx, next)).resolves.not.toThrow();

    expect(requestWithRetry).toHaveBeenCalledTimes(1);
    expect(requestWithRetry).toHaveBeenCalledWith(expect.any(Function), ctx);

    expect(ctx.res).toEqual({ response: true });
  });
});
