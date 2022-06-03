import { ILogger } from "@lindorm-io/winston";

export interface ResponseTime {
  axios: number;
  server: number | undefined;
  diff: number | undefined;
}

export interface LogOptions {
  logger: ILogger;
  name: string | null;
  time: ResponseTime;
}
