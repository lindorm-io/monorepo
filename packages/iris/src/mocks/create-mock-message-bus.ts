import type { IMessage } from "../interfaces/Message";
import type { IIrisMessageBus } from "../interfaces/IrisMessageBus";
import type { PublishOptions, SubscribeOptions } from "../types";

export type MockMessageBus<M extends IMessage = IMessage> = IIrisMessageBus<M> & {
  published: Array<M>;
  clearPublished(): void;
};

export const createMockMessageBus = <
  M extends IMessage = IMessage,
>(): MockMessageBus<M> => {
  const published: Array<M> = [];

  return {
    published,

    create: jest.fn((_options?: Partial<M>): M => ({}) as M),

    hydrate: jest.fn((data: Record<string, unknown>): M => data as unknown as M),

    copy: jest.fn((message: M): M => ({ ...message })),

    validate: jest.fn((_message: M): void => {}),

    publish: jest.fn(
      async (message: M | Array<M>, _options?: PublishOptions): Promise<void> => {
        if (Array.isArray(message)) {
          published.push(...message);
        } else {
          published.push(message);
        }
      },
    ),

    subscribe: jest.fn(
      async (
        _options: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
      ): Promise<void> => {},
    ),

    unsubscribe: jest.fn(
      async (_options: { topic: string; queue?: string }): Promise<void> => {},
    ),

    unsubscribeAll: jest.fn(async (): Promise<void> => {}),

    clearPublished: (): void => {
      published.length = 0;
    },
  };
};
