import _axios from "axios";
import { requestWithRetry } from "./request-with-retry";

jest.mock("axios");
jest.mock("@lindorm-io/core");

const axios = _axios as any;

describe("requestWithRetry", () => {
  let config: any;
  let options: any;
  let retryCallback: any;

  beforeEach(() => {
    config = { config: true };
    options = { options: true };
    retryCallback = () => true;
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(requestWithRetry(config, options, retryCallback)).resolves.not.toThrow();

    expect(axios.request).toHaveBeenCalledTimes(1);
    expect(axios.request).toHaveBeenCalledWith({ config: true });
  });

  test("should retry", async () => {
    axios.request.mockRejectedValueOnce(new Error("message"));

    await expect(requestWithRetry(config, options, retryCallback)).resolves.not.toThrow();

    expect(axios.request).toHaveBeenCalledTimes(2);
    expect(axios.request).toHaveBeenCalledWith({ config: true });
  });
});
