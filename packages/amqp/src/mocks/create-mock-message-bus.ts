import { IMessageBus, IMessage, ISubscription, UnsubscribeOptions } from "../types";
import { MessageBusBase } from "../infrastructure";
import { flatten } from "lodash";

export const createMockMessageBus = <Bus extends MessageBusBase>(): Bus => {
  let array: Array<ISubscription> = [];

  const messageBus: IMessageBus = {
    publish: jest.fn().mockImplementation(async (messages: Array<IMessage>) => {
      const list = Array.isArray(messages) ? messages : [messages];

      for (const message of list) {
        const subscriptions = array.filter((a) => a.topic === message.topic);

        for (const subscription of subscriptions) {
          if (message.delay) {
            setTimeout(() => subscription.callback(message), message.delay);
          } else {
            await subscription.callback(message);
          }
        }
      }
    }),

    subscribe: jest.fn().mockImplementation(async (subscriptions: Array<ISubscription>) => {
      array = flatten([array, subscriptions]);
    }),

    unsubscribe: jest
      .fn()
      .mockImplementation(async (subscriptions: UnsubscribeOptions | Array<UnsubscribeOptions>) => {
        const list = Array.isArray(subscriptions) ? subscriptions : [subscriptions];

        for (const sub of list) {
          array = array.filter((x) => x.topic !== sub.topic && x.queue !== sub.queue);
        }
      }),

    unsubscribeAll: jest.fn().mockImplementation(async () => {
      array = [];
    }),
  };

  return messageBus as Bus;
};
