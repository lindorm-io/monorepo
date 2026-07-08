import type { IConduit } from "../interfaces/index.js";
import type { ConduitResponse } from "../types/index.js";

export const _createMockConduit = (mockFn: () => any): IConduit => {
  const resolves = (value: any) => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };

  const response: ConduitResponse = {
    cached: null,
    data: {},
    status: 200,
    statusText: "OK",
    headers: {},
  };

  return {
    delete: resolves(response),
    get: resolves(response),
    head: resolves(response),
    options: resolves(response),
    patch: resolves(response),
    post: resolves(response),
    put: resolves(response),
    request: resolves(response),
  } as unknown as IConduit;
};
