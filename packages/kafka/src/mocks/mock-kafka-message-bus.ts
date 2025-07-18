import { IMessage, IMessageSubscription, MessageKit } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { IKafkaMessageBus } from "../interfaces";

export const createMockKafkaMessageBus = <M extends IMessage>(
  target: Constructor<M>,
): IKafkaMessageBus<M> => {
  const kit = new MessageKit({ target });

  let array: Array<IMessageSubscription<M>> = [];

  return {
    create: jest.fn().mockImplementation((args) => kit.create(args)),
    copy: jest.fn().mockImplementation((args) => kit.copy(args)),
    publish: jest.fn().mockImplementation(async (args) => {
      const list = Array.isArray(args) ? args : [args];

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
      array = [array, args].flat();
    }),
    unsubscribe: jest.fn().mockImplementation(async (args) => {
      const list = Array.isArray(args) ? args : [args];

      for (const sub of list) {
        array = array.filter((x) => x.topic !== sub.topic && x.queue !== sub.queue);
      }
    }),
    unsubscribeAll: jest.fn().mockImplementation(async () => {
      array = [];
    }),

    disconnect: jest.fn().mockImplementation(async () => {
      array = [];
    }),
  };
};
