import { IMessageBus, IMessage, ISubscription } from "../types";
import { flatten } from "lodash";

export const createMockMessageBus = (): IMessageBus<any, any> => {
  let array: Array<ISubscription> = [];

  return {
    publish: jest.fn().mockImplementation(async (messages: Array<IMessage>) => {
      for (const message of messages) {
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
};
