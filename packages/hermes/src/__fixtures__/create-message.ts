import { MessageKit } from "@lindorm/message";
import { ClassLike, DeepPartial, Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../messages";
import { extractDataTransferObject } from "../utils/private";
import { createTestAggregateIdentifier } from "./create-test-aggregate-identifier";

const commandKit = new MessageKit({ Message: HermesCommand });
const errorKit = new MessageKit({ Message: HermesError });
const eventKit = new MessageKit({ Message: HermesEvent });
const timeoutKit = new MessageKit({ Message: HermesTimeout });

export const createTestCommand = (
  dto: ClassLike,
  options: DeepPartial<HermesCommand<Dict>> = {},
): HermesCommand<typeof dto> => {
  const id = randomUUID();

  return commandKit.create({
    id,
    aggregate: createTestAggregateIdentifier(),
    causationId: id,
    meta: { origin: "test" },
    ...extractDataTransferObject(dto),
    ...options,
  });
};

export const createTestError = (
  dto: ClassLike,
  options: DeepPartial<HermesError> = {},
): HermesError => {
  const id = randomUUID();

  return errorKit.create({
    id,
    aggregate: createTestAggregateIdentifier(),
    causationId: id,
    meta: { origin: "test" },
    ...extractDataTransferObject(dto),
    ...options,
  });
};

export const createTestEvent = (
  dto: ClassLike,
  options: DeepPartial<HermesEvent> = {},
): HermesEvent<typeof dto> => {
  const id = randomUUID();

  return eventKit.create({
    id,
    aggregate: createTestAggregateIdentifier(),
    causationId: id,
    meta: { origin: "test" },
    ...extractDataTransferObject(dto),
    ...options,
  });
};

export const createTestTimeout = (
  dto: ClassLike,
  options: DeepPartial<HermesTimeout> = {},
): HermesTimeout => {
  const id = randomUUID();

  return timeoutKit.create({
    id,
    aggregate: createTestAggregateIdentifier(),
    causationId: id,
    meta: { origin: "test" },
    ...extractDataTransferObject(dto),
    ...options,
  });
};
