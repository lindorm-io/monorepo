export type IrisSampleFiles = {
  publisher: string;
  subscriber: string;
};

const publisherContent = (): string =>
  [
    `import { source as irisSource } from "../source.js";`,
    `import { SampleMessage } from "../messages/SampleMessage.js";`,
    ``,
    `const publisher = irisSource.publisher(SampleMessage);`,
    ``,
    `export const publishSample = async (`,
    `  payload: Partial<SampleMessage> = {},`,
    `): Promise<void> => {`,
    `  await publisher.publish(publisher.create(payload));`,
    `};`,
    ``,
  ].join("\n");

const subscriberContent = (): string =>
  [
    `import { logger } from "../../logger/index.js";`,
    `import { source as irisSource } from "../source.js";`,
    `import { SampleMessage } from "../messages/SampleMessage.js";`,
    ``,
    `const bus = irisSource.messageBus(SampleMessage);`,
    ``,
    `export const subscribeSample = async (): Promise<void> => {`,
    `  await bus.subscribe({`,
    `    topic: "SampleMessage",`,
    `    queue: "sample-queue",`,
    `    callback: async (msg) => {`,
    `      logger.info("Received sample message", { message: msg });`,
    `    },`,
    `  });`,
    `};`,
    ``,
  ].join("\n");

export const buildIrisSamples = (): IrisSampleFiles => ({
  publisher: publisherContent(),
  subscriber: subscriberContent(),
});
