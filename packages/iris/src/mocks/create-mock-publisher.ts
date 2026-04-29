import type { IIrisPublisher } from "../interfaces/IrisPublisher.js";
import type { IMessage } from "../interfaces/Message.js";

export type PublisherExtras<M extends IMessage> = {
  published: Array<M>;
  clearPublished(): void;
};

export const _createMockPublisher = <M extends IMessage = IMessage>(
  mockFn: () => any,
): IIrisPublisher<M> & PublisherExtras<M> => {
  const published: Array<M> = [];
  const impl = (fn: any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };

  return {
    published,

    create: impl((_options?: Partial<M>): M => ({}) as M),
    hydrate: impl((data: Record<string, unknown>): M => data as unknown as M),
    copy: impl((message: M): M => ({ ...message })),
    validate: impl((_message: M): void => {}),

    publish: impl(async (message: M | Array<M>): Promise<void> => {
      if (Array.isArray(message)) {
        published.push(...message);
      } else {
        published.push(message);
      }
    }),

    clearPublished: (): void => {
      published.length = 0;
    },
  } as unknown as IIrisPublisher<M> & PublisherExtras<M>;
};
