import { AxiosClientProperties } from "@lindorm-io/axios";

export interface JwksKeysMiddlewareConfig {
  host: string;
  port?: number;
  alias: string;
  client?: Partial<AxiosClientProperties>;
  path?: string;
}
