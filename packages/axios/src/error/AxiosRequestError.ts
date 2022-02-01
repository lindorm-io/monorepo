import { LindormError, LindormErrorOptions, ILindormError } from "@lindorm-io/errors";
import { AxiosConfig, AxiosRequest, AxiosResponse, Unknown } from "../types";

export interface IAxiosRequestError extends ILindormError {
  readonly config: AxiosConfig;
  readonly request: AxiosRequest;
  readonly response: AxiosResponse<Unknown>;
  readonly statusCode: number;
}

export interface AxiosRequestErrorOptions extends LindormErrorOptions {
  config: AxiosConfig;
  request: AxiosRequest;
  response: AxiosResponse<Unknown>;
  statusCode: number;
}

export class AxiosRequestError extends LindormError {
  public readonly config: AxiosConfig;
  public readonly request: AxiosRequest;
  public readonly response: AxiosResponse<Unknown>;
  public readonly statusCode: number;

  public constructor(message: string, options: AxiosRequestErrorOptions) {
    super(message, options);

    this.config = options.config;
    this.request = options.request;
    this.response = options.response;
    this.statusCode = options.statusCode;
  }
}
