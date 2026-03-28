import type { ConfirmChannel, Options } from "amqplib";
import { IrisPublishError } from "../../../../errors/IrisPublishError";

export const publishToExchange = (
  channel: ConfirmChannel,
  exchange: string,
  routingKey: string,
  content: Buffer,
  options: Options.Publish,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const published = channel.publish(exchange, routingKey, content, options, (err) => {
      if (settled) return;
      settled = true;

      if (err) {
        reject(
          new IrisPublishError(`Publisher confirm failed: ${err.message}`, {
            debug: { exchange, routingKey },
          }),
        );
      } else {
        resolve();
      }
    });

    if (!published && !settled) {
      settled = true;
      reject(
        new IrisPublishError("Channel write buffer full", {
          debug: { exchange, routingKey },
        }),
      );
    }
  });
};
