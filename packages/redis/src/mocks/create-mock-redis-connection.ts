import { ConnectionStatus } from "@lindorm-io/core-connection";
import { IRedisConnection } from "../types";
import { Redis } from "ioredis";
import { RedisConnection } from "../connections";

type Options = {
  del?: jest.Mock;
  get?: jest.Mock;
  scan?: jest.Mock;
  set?: jest.Mock;
  setex?: jest.Mock;
  ttl?: jest.Mock;
};

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
    client,
    connect: jest.fn(),
    disconnect: jest.fn(),
    namespace: "namespace",

    status: ConnectionStatus.CONNECTED,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,

    on: jest.fn(),
  };

  return connection as RedisConnection;
};
