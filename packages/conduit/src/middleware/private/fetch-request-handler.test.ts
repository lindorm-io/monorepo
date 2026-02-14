import {
  composeFetchConfig as _composeFetchConfig,
  requestWithRetry as _requestWithRetry,
  useFetch as _useFetch,
} from "../../utils/private";
import { fetchRequestHandler } from "./fetch-request-handler";

jest.mock("../../utils/private");

const requestWithRetry = _requestWithRetry as jest.Mock;
const composeFetchConfig = _composeFetchConfig as jest.Mock;
const useFetch = _useFetch as jest.Mock;

describe("fetchRequestHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = { req: "ctx" };

    composeFetchConfig.mockReturnValueOnce({ config: true });
    useFetch.mockResolvedValueOnce({ response: true });
    requestWithRetry.mockResolvedValueOnce({ response: true });
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(fetchRequestHandler(ctx, jest.fn())).resolves.toBeUndefined();

    expect(requestWithRetry).toHaveBeenCalledTimes(1);
    expect(requestWithRetry).toHaveBeenCalledWith(expect.any(Function), ctx);

    expect(ctx.res).toEqual({ response: true });
  });
});
