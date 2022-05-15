import { AxiosMiddleware } from "@lindorm-io/axios";

export interface AxiosMiddlewareConfig {
  clientName: string;
  host?: string;
  port?: number;
  middleware?: Array<AxiosMiddleware>;
}
