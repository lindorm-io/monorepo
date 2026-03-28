import type { IMessage } from "../interfaces/Message";
import type { IIrisWorkerQueue } from "../interfaces/IrisWorkerQueue";
import type { ConsumeEnvelope, ConsumeOptions, PublishOptions } from "../types";

export type MockWorkerQueue<M extends IMessage = IMessage> = IIrisWorkerQueue<M> & {
  published: Array<M>;
  clearPublished(): void;
};

export const createMockWorkerQueue = <
  M extends IMessage = IMessage,
>(): MockWorkerQueue<M> => {
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

    consume: jest.fn(
      async (
        _queueOrOptions: string | ConsumeOptions<M> | Array<ConsumeOptions<M>>,
        _callback?: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
      ): Promise<void> => {},
    ),

    unconsume: jest.fn(async (_queue: string): Promise<void> => {}),

    unconsumeAll: jest.fn(async (): Promise<void> => {}),

    clearPublished: (): void => {
      published.length = 0;
    },
  };
};
