import { Channel, ConfirmChannel, Connection } from "amqplib";
import { ConnectionStatus } from "@lindorm-io/core-connection";
import { IAmqpConnection } from "../types";

export const createMockAmqpConnection = (): IAmqpConnection => {
  const channel = {
    close: jest.fn().mockResolvedValue(undefined),

    assertQueue: jest.fn().mockResolvedValue(undefined),
    checkQueue: jest.fn().mockResolvedValue(undefined),

    deleteQueue: jest.fn().mockResolvedValue(undefined),
    purgeQueue: jest.fn().mockResolvedValue(undefined),

    bindQueue: jest.fn().mockResolvedValue(undefined),
    unbindQueue: jest.fn().mockResolvedValue(undefined),

    assertExchange: jest.fn().mockResolvedValue(undefined),
    checkExchange: jest.fn().mockResolvedValue(undefined),

    deleteExchange: jest.fn().mockResolvedValue(undefined),

    bindExchange: jest.fn().mockResolvedValue(undefined),
    unbindExchange: jest.fn().mockResolvedValue(undefined),

    publish: jest.fn().mockImplementation(() => true),
    sendToQueue: jest.fn().mockImplementation(() => true),

    consume: jest.fn().mockResolvedValue(undefined),

    cancel: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(undefined),

    ack: jest.fn(),
    ackAll: jest.fn(),

    nack: jest.fn(),
    nackAll: jest.fn(),
    reject: jest.fn(),

    prefetch: jest.fn().mockResolvedValue(undefined),
    recover: jest.fn().mockResolvedValue(undefined),
  } as unknown as Channel;

  const confirmChannel = {
    ...channel,

    publish: jest.fn().mockImplementation(() => true),
    sendToQueue: jest.fn().mockImplementation(() => true),
    waitForConfirms: jest.fn().mockResolvedValue(undefined),
  } as unknown as ConfirmChannel;

  const client = {
    close: jest.fn(),
    createChannel: jest.fn().mockImplementation(async () => channel),
    createConfirmChannel: jest.fn().mockImplementation(async () => confirmChannel),
  } as unknown as Connection;

  const connection: IAmqpConnection = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    client,

    status: ConnectionStatus.CONNECTED,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,

    bindQueue: jest.fn().mockResolvedValue(undefined),
    channel: confirmChannel,
    deadLetters: "deadLetters",
    exchange: "exchange",

    on: jest.fn(),
  };

  return connection as IAmqpConnection;
};
