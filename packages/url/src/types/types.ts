import { QueryRecord } from "@lindorm-io/common-types";

export type Protocol = "http" | "https";

export type UrlData = {
  host: string | undefined;
  pathname: string | undefined;
  port: number | undefined;
  protocol: Protocol | undefined;
  query: QueryRecord;
};
