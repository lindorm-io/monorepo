import { ILogger } from "@lindorm-io/winston";

export interface FetchDataContext<Data> {
  logger: ILogger;
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
  logger: ILogger;
  name: string;
  ttl?: number;
}

export interface InMemoryCacheStatus {
  fetching: boolean;
  size: number;
  timestamp: Date | undefined;
  ttl: number;
}
