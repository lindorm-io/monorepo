import { IMessage, IMessageSubscription, MessageKit } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { IRabbitPublisher } from "../interfaces";

export const createMockRabbitPublisher = <M extends IMessage>(
  target: Constructor<M>,
  subscriptions: Array<IMessageSubscription<M>> = [],
): IRabbitPublisher<M> => {
  const kit = new MessageKit({ target });

  return {
    create: jest.fn().mockImplementation((args) => kit.create(args)),
    copy: jest.fn().mockImplementation((args) => kit.copy(args)),
    publish: jest.fn().mockImplementation(async (args) => {
      const list = Array.isArray(args) ? args : [args];

      for (const message of list) {
        const topic = kit.getTopicName(message);
        const subs = subscriptions.filter((a) => a.topic === topic);

        for (const subscription of subs) {
          if (message.delay) {
            setTimeout(() => subscription.callback(message), message.delay);
          } else {
            await subscription.callback(message);
          }
        }
      }
    }),
  };
};
