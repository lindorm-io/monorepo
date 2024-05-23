import { composeFetchConfig as _composeFetchConfig } from "../../utils/private/compose-fetch-config";
import { requestWithRetry as _requestWithRetry } from "../../utils/private/request-with-retry";
import { useFetch as _useFetch } from "../../utils/private/use-fetch";
import { fetchRequestHandler } from "./fetch-request-handler";

jest.mock("../../utils/private/compose-fetch-config");
jest.mock("../../utils/private/request-with-retry");
jest.mock("../../utils/private/use-fetch");

const requestWithRetry = _requestWithRetry as jest.Mock;
const composeFetchConfig = _composeFetchConfig as jest.Mock;
const useFetch = _useFetch as jest.Mock;

describe("fetchRequestHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = { req: "ctx" };

    composeFetchConfig.mockResolvedValueOnce({ config: true });
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
