import { AnyObject } from "./util";
import { AxiosRequest, AxiosResponse, RequestConfig, RequestOptions } from "./axios";
import { IAxiosRequestError } from "../error";

export interface AxiosMiddleware<Data = AnyObject> {
  config?: (config: RequestConfig) => Promise<RequestConfig>;
  error?: (error: IAxiosRequestError) => Promise<IAxiosRequestError>;
  request?: (request: AxiosRequest) => Promise<AxiosRequest>;
  response?: (response: AxiosResponse<Data>) => Promise<AxiosResponse<Data>>;
  retry?: (error: IAxiosRequestError, options: RequestOptions) => Promise<boolean>;
}
