import { Logger } from "@lindorm-io/winston";

export interface ResponseTime {
  axios: number;
  server: number | undefined;
  diff: number | undefined;
}

export interface LogOptions {
  logger: Logger;
  name: string | null;
  time: ResponseTime;
}
