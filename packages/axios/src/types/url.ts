import { Protocol } from "./request";

export type UrlData = {
  host: string | undefined;
  pathname: string;
  port: number | undefined;
  protocol: Protocol | undefined;
  query: Record<string, any>;
};
