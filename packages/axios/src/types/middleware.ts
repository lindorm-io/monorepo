import { AxiosRequest, AxiosResponse, RequestConfig, RequestOptions } from "./axios";
import { IAxiosRequestError } from "../error";

export interface AxiosMiddleware<Data = Record<string, any>> {
  config?: (config: RequestConfig) => Promise<RequestConfig>;
  error?: (error: IAxiosRequestError) => Promise<IAxiosRequestError>;
  request?: (request: AxiosRequest) => Promise<AxiosRequest>;
  response?: (response: AxiosResponse<Data>) => Promise<AxiosResponse<Data>>;
  retry?: (error: IAxiosRequestError, options: RequestOptions) => Promise<boolean>;
}
