import { Logger } from "@lindorm-io/winston";
import { isAfter, addSeconds } from "date-fns";
import { LindormError } from "@lindorm-io/errors";

export type FetchDataFunction<Data> = (data: Map<string, Data>) => Promise<Map<string, Data>>;

export interface InMemoryCacheOptions<Data> {
  fetchDataFunction: FetchDataFunction<Data>;
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

export class InMemoryCache<Data> {
  private readonly fetchDataFunction: FetchDataFunction<Data>;
  private readonly intervalTick: number;
  private readonly intervalTimeout: number;
  private readonly ttl: number;
  private data: Map<string, Data>;
  private fetching: boolean;
  private logger: Logger;
  private timestamp: Date | undefined;

  public constructor(options: InMemoryCacheOptions<Data>) {
    this.logger = options.logger.createChildLogger(["InMemoryCache", options.name]);
    this.logger.verbose("Initialising");

    this.data = new Map<string, Data>();
    this.fetchDataFunction = options.fetchDataFunction;
    this.fetching = false;
    this.intervalTick = options.intervalTick || 100;
    this.intervalTimeout = options.intervalTimeout || 10000;
    this.ttl = options.ttl || 60 * 12;

    this.safelyFetchData().then();
  }

  public get(key: string): Data | undefined {
    if (this.shouldFetch()) {
      this.safelyFetchData().then();
    }
    return this.data.get(key);
  }

  public set(key: string, data: Data): void {
    this.data.set(key, data);
  }

  public delete(key: string): void {
    this.data.delete(key);
  }

  public scan(): Array<Data> {
    if (this.shouldFetch()) {
      this.safelyFetchData().then();
    }
    return Array.from(this.data.values());
  }

  public status(): InMemoryCacheStatus {
    return {
      fetching: this.fetching,
      size: this.data.size,
      timestamp: this.timestamp,
      ttl: this.ttl,
    };
  }

  public async ping(): Promise<void> {
    if (!this.shouldFetch()) return;
    return this.safelyFetchData();
  }

  public async reload(): Promise<void> {
    return this.safelyFetchData();
  }

  private shouldFetch(): boolean {
    if (!this.timestamp) {
      this.logger.verbose("Should fetch (undefined timestamp)", {
        timestamp: this.timestamp,
      });

      return true;
    }

    const now = new Date();

    if (isAfter(now, addSeconds(this.timestamp, this.ttl))) {
      this.logger.verbose("Should fetch (timestamp expiry)", {
        now,
        timestamp: this.timestamp,
        ttl: this.ttl,
      });

      return true;
    }

    return false;
  }

  private async safelyFetchData(): Promise<void> {
    return this.fetchDataAsync().catch((err) => {
      this.logger.verbose(err);
    });
  }

  private async fetchDataAsync(): Promise<void> {
    if (this.fetching) {
      this.logger.verbose("Fetching data using interval");

      return new Promise((resolve, reject) => {
        let current = 0;

        const interval = setInterval(() => {
          current += this.intervalTick;

          if (!this.fetching) {
            clearInterval(interval);
            resolve();
          }

          if (current >= this.intervalTimeout) {
            reject(new LindormError("Interval Timeout"));
          }
        }, this.intervalTick);
      });
    }

    this.fetching = true;

    try {
      this.logger.verbose("Fetching data using fetchDataFunction");
      const data = await this.fetchDataFunction(this.data);

      if (!data || !(data instanceof Map)) {
        throw new LindormError("Invalid data");
      }

      this.data = data;
      this.timestamp = new Date();
      this.fetching = false;
    } catch (err) {
      this.fetching = false;
      throw err;
    }
  }
}
