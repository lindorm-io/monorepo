export type IrisSampleFiles = {
  publisher: string;
  subscriber: string;
};

const publisherContent = (busDriver: string): string =>
  [
    `import { ${busDriver} } from "../source.js";`,
    `import { SampleMessage } from "../messages/SampleMessage.js";`,
    ``,
    `const publisher = ${busDriver}.publisher(SampleMessage);`,
    ``,
    `export const publishSample = async (`,
    `  payload: Partial<SampleMessage> = {},`,
    `): Promise<void> => {`,
    `  await publisher.publish(publisher.create(payload));`,
    `};`,
    ``,
  ].join("\n");

const subscriberContent = (busDriver: string): string =>
  [
    `import { logger } from "../../logger/index.js";`,
    `import { ${busDriver} } from "../source.js";`,
    `import { SampleMessage } from "../messages/SampleMessage.js";`,
    ``,
    `const bus = ${busDriver}.messageBus(SampleMessage);`,
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

export const buildIrisSamples = (busDriver: string): IrisSampleFiles => ({
  publisher: publisherContent(busDriver),
  subscriber: subscriberContent(busDriver),
});
