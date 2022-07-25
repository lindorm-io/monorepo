import { ConnectionStatus } from "@lindorm-io/core-connection";
import { IRedisConnection } from "../types";
import { Redis } from "ioredis";
import { RedisConnection } from "../connection";

interface Options {
  [key: string]: jest.Mock;

  del?: jest.Mock;
  get?: jest.Mock;
  scan?: jest.Mock;
  set?: jest.Mock;
  setex?: jest.Mock;
  ttl?: jest.Mock;
}

export const createMockRedisConnection = (o: Options = {}): RedisConnection => {
  const client = {
    del: jest.fn(),
    get: jest.fn(),
    scan: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    ttl: jest.fn(),
    ...o,
  } as unknown as Redis;

  const connection: IRedisConnection = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    client,
    status: ConnectionStatus.CONNECTED,
    on: jest.fn(),
  };

  return connection as RedisConnection;
};
