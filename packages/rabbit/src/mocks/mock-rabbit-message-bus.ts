import { Constructor } from "@lindorm/types";
import { IRabbitMessage, IRabbitMessageBus, IRabbitSubscription } from "../interfaces";

export const createMockRabbitMessageBus = <M extends IRabbitMessage>(
  Message: Constructor<M>,
): IRabbitMessageBus<M> => {
  let array: Array<IRabbitSubscription<M>> = [];

  return {
    create: jest.fn().mockImplementation((args) => new Message(args)),
    publish: jest.fn().mockImplementation(async (args) => {
      const list = Array.isArray(args) ? args : [args];

      for (const message of list) {
        const subs = array.filter((a) => a.topic === message.topic);

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
  };
};
