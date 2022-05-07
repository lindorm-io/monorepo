import { Logger } from "@lindorm-io/winston";
import { isAfter, addSeconds } from "date-fns";
import { LindormError } from "@lindorm-io/errors";
import {
  FetchDataFunction,
  GetKeyFunction,
  InMemoryCacheOptions,
  InMemoryCacheStatus,
} from "../types";

export class InMemoryCache<Data> {
  private readonly fetchDataFunction: FetchDataFunction<Data>;
  private readonly getKeyFunction: GetKeyFunction<Data>;
  private readonly intervalTick: number;
  private readonly intervalTimeout: number;
  private readonly ttl: number;
  private data: Map<string, Data>;
  private fetching: boolean;
  private logger: Logger;
  private timestamp: Date | undefined;

  public constructor(options: InMemoryCacheOptions<Data>) {
    this.logger = options.logger.createChildLogger(["InMemoryCache", options.name]);
    this.logger.debug("Initialising");

    this.data = new Map<string, Data>();
    this.fetchDataFunction = options.fetchDataFunction;
    this.getKeyFunction = options.getKeyFunction;
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

  public async getAsync(key: string): Promise<Data | undefined> {
    if (this.shouldFetch()) {
      await this.fetchDataAsync();
    }
    return this.data.get(key);
  }

  public set(data: Data): Data {
    this.data.set(this.getKeyFunction(data), data);
    return data;
  }

  public delete(key: string): void {
    this.data.delete(key);
  }

  public destroy(data: Data): void {
    this.data.delete(this.getKeyFunction(data));
  }

  public scan(): Array<Data> {
    if (this.shouldFetch()) {
      this.safelyFetchData().then();
    }
    return Array.from(this.data.values());
  }

  public async scanAsync(): Promise<Array<Data>> {
    if (this.shouldFetch()) {
      await this.fetchDataAsync();
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

  public async heartbeat(): Promise<void> {
    if (!this.shouldFetch()) {
      return;
    }
    return this.safelyFetchData();
  }

  public async reload(): Promise<void> {
    return this.safelyFetchData();
  }

  private shouldFetch(): boolean {
    if (!this.timestamp) {
      this.logger.debug("should fetch (undefined timestamp)", {
        timestamp: this.timestamp,
      });

      return true;
    }

    const now = new Date();

    if (isAfter(now, addSeconds(this.timestamp, this.ttl))) {
      this.logger.debug("should fetch (timestamp expiry)", {
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
      this.logger.debug(err);
    });
  }

  private async fetchDataAsync(): Promise<void> {
    if (this.fetching) {
      this.logger.debug("fetching data using interval");

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
      this.logger.debug("fetching data using fetchDataFunction");
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
