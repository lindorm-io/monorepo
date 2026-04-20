import type { IIrisWorkerQueue } from "../interfaces/IrisWorkerQueue";
import type { IMessage } from "../interfaces/Message";

export type WorkerQueueExtras<M extends IMessage> = {
  published: Array<M>;
  clearPublished(): void;
};

export const _createMockWorkerQueue = <M extends IMessage = IMessage>(
  mockFn: () => any,
): IIrisWorkerQueue<M> & WorkerQueueExtras<M> => {
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

    consume: impl(async (): Promise<void> => {}),
    unconsume: impl(async (): Promise<void> => {}),
    unconsumeAll: impl(async (): Promise<void> => {}),

    clearPublished: (): void => {
      published.length = 0;
    },
  } as unknown as IIrisWorkerQueue<M> & WorkerQueueExtras<M>;
};
