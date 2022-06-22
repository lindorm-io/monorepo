import { AxiosMiddleware, AxiosRequest, AxiosResponse } from "../../types";
import { camelKeys, snakeKeys, isObjectStrict } from "@lindorm-io/core";

export const axiosCaseSwitchMiddleware: AxiosMiddleware = {
  request: async (request): Promise<AxiosRequest> => ({
    ...request,
    body: isObjectStrict(request.body) ? snakeKeys(request.body) : undefined,
  }),
  response: async (response): Promise<AxiosResponse<any>> => ({
    ...response,
    data: isObjectStrict(response.data) ? camelKeys(response.data) : {},
  }),
};
