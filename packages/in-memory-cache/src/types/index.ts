import { Logger } from "@lindorm-io/winston";

export interface FetchDataContext<Data> {
  logger: Logger;
  clear(): void;
  delete(key: string): void;
  destroy(data: Data): void;
  get(key: string): Data | undefined;
  scan(): Array<Data>;
  set(data: Data): void;
}

export type FetchDataFunction<Data> = (context: FetchDataContext<Data>) => Promise<void>;

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
