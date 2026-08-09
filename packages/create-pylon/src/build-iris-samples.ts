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

// A DECLARED subscription, not a `subscribeSample()` somebody has to remember to
// call: the pylon file lists it under `subscriptions`, and pylon binds it at boot
// alongside its own audit and webhook consumers — and registers `SampleMessage`
// on the bus while it is at it, so the source needs no second declaration. It
// therefore names no source of its own, which is why nothing here imports one.
const subscriberContent = (): string =>
  [
    `import type { PylonSubscribeSettings } from "@lindorm/pylon";`,
    `import { logger } from "../../logger/index.js";`,
    `import { SampleMessage } from "../messages/SampleMessage.js";`,
    ``,
    `export const sampleSubscription: PylonSubscribeSettings<SampleMessage> = {`,
    `  message: SampleMessage,`,
    `  // Bound verbatim — match what the publisher resolves (a static \`@Topic\`,`,
    `  // else the class name). Drop \`queue\` to broadcast to every instance.`,
    `  topic: "SampleMessage",`,
    `  queue: "sample-queue",`,
    `  callback: async (msg, envelope) => {`,
    `    logger.debug("Received sample message", {`,
    `      topic: envelope.topic,`,
    `      correlationId: envelope.correlationId,`,
    `    });`,
    `  },`,
    `};`,
    ``,
  ].join("\n");

export const buildIrisSamples = (busDriver: string): IrisSampleFiles => ({
  publisher: publisherContent(busDriver),
  subscriber: subscriberContent(),
});
