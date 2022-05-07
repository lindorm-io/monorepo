import { Logger } from "@lindorm-io/winston";

export type FetchDataFunction<Data> = (data: Map<string, Data>) => Promise<Map<string, Data>>;

export type GetKeyFunction<Data> = (data: Data) => string;

export interface InMemoryCacheOptions<Data> {
  fetchDataFunction: FetchDataFunction<Data>;
  getKeyFunction: GetKeyFunction<Data>;
  intervalTick?: number;
  intervalTimeout?: number;
  logger: Logger;
  name: string;
  ttl?: number;
}

export interface InMemoryCacheStatus {
  fetching: boolean;
  size: number;
  timestamp: Date | undefined;
  ttl: number;
}
