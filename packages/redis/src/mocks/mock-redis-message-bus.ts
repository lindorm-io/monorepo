import { IMessage, IMessageSubscription, MessageKit } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { IRedisMessageBus } from "../interfaces";

export const createMockRedisMessageBus = <M extends IMessage>(
  target: Constructor<M>,
  log = false,
): IRedisMessageBus<M> => {
  const kit = new MessageKit({ target });

  let array: Array<IMessageSubscription<M>> = [];

  return {
    create: jest.fn().mockImplementation((args) => kit.create(args)),
    publish: jest.fn().mockImplementation(async (args) => {
      const list = Array.isArray(args) ? args : [args];

      if (log) console.log(args);

      for (const message of list) {
        const topic = kit.getTopicName(message);
        const subs = array.filter((a) => a.topic === topic);

        for (const subscription of subs) {
          if (message.delay) {
            setTimeout(() => subscription.callback(message), message.delay);
          } else {
            await subscription.callback(message);
          }
        }
      }
    }),
    subscribe: jest.fn().mockImplementation(async (args) => {
      if (log) console.log(args);

      array = [array, args].flat();
    }),
    unsubscribe: jest.fn().mockImplementation(async (args) => {
      if (log) console.log(args);

      const list = Array.isArray(args) ? args : [args];

      for (const sub of list) {
        array = array.filter((x) => x.topic !== sub.topic && x.queue !== sub.queue);
      }
    }),
    unsubscribeAll: jest.fn().mockImplementation(async () => {
      array = [];
    }),
  };
};
