import { AnyObject, AxiosMiddleware, AxiosRequest, AxiosResponse } from "../../types";
import { camelKeys, snakeKeys, isObjectStrict } from "@lindorm-io/core";

export const axiosCaseSwitchMiddleware: AxiosMiddleware = {
  request: async (request): Promise<AxiosRequest> => ({
    ...request,
    data: isObjectStrict(request.data) ? snakeKeys<any, AnyObject>(request.data) : undefined,
  }),
  response: async (response): Promise<AxiosResponse<any>> => ({
    ...response,
    data: isObjectStrict(response.data) ? camelKeys<any, AnyObject>(response.data) : {},
  }),
};
