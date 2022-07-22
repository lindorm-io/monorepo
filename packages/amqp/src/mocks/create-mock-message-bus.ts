import { MessageBusBase } from "../infrastructure";
import { IMessageBus, IMessage, ISubscription } from "../types";
import { flatten, isArray } from "lodash";

export const createMockMessageBus = <Bus extends MessageBusBase>(): Bus => {
  let array: Array<ISubscription> = [];

  const messageBus: IMessageBus = {
    publish: jest.fn().mockImplementation(async (messages: Array<IMessage>) => {
      const list = isArray(messages) ? messages : [messages];

      for (const message of list) {
        for (const sub of array) {
          if (message.routingKey !== sub.routingKey) continue;
          await sub.callback(message);
        }
      }
    }),
    subscribe: jest.fn().mockImplementation(async (subscriptions: Array<ISubscription>) => {
      array = flatten([array, subscriptions]);
    }),
  };

  return messageBus as Bus;
};
