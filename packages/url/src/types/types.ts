export type ParamsRecord = Record<
  string,
  string | number | boolean | Array<string | number | boolean>
>;

export type Protocol = "http" | "https";

export type QueryRecord = Record<
  string,
  string | number | boolean | Array<string | number | boolean>
>;

export type UrlData = {
  host: string | undefined;
  pathname: string;
  port: number | undefined;
  protocol: Protocol | undefined;
  query: QueryRecord;
};
