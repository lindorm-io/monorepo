import type { IMessage } from "../interfaces/Message";
import type { IIrisPublisher } from "../interfaces/IrisPublisher";
import type { PublishOptions } from "../types";

export type MockPublisher<M extends IMessage = IMessage> = IIrisPublisher<M> & {
  published: Array<M>;
  clearPublished(): void;
};

export const createMockPublisher = <
  M extends IMessage = IMessage,
>(): MockPublisher<M> => {
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

    clearPublished: (): void => {
      published.length = 0;
    },
  };
};
