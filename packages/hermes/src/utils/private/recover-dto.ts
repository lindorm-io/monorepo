import { ClassLike } from "@lindorm/types";
import { IHermesMessage } from "../../interfaces";
import { MetaCommand, MetaEvent, MetaQuery, MetaTimeout } from "../../types";
import { globalHermesMetadata } from "./global";

const recover = (
  message: IHermesMessage,
  metadata?: MetaCommand | MetaEvent | MetaQuery | MetaTimeout,
): ClassLike => {
  if (!metadata) {
    throw new Error(`Metadata not found for name: ${message.name}`);
  }

  const dto = new metadata.target();

  for (const [key, value] of Object.entries(message.data)) {
    dto[key] = value;
  }

  return dto;
};

export const recoverCommand = (message: IHermesMessage): ClassLike =>
  recover(message, globalHermesMetadata.findCommand(message.name));

export const recoverEvent = (message: IHermesMessage): ClassLike =>
  recover(message, globalHermesMetadata.findEvent(message.name, message.version));

export const recoverQuery = (message: IHermesMessage): ClassLike =>
  recover(message, globalHermesMetadata.findQuery(message.name));

export const recoverTimeout = (message: IHermesMessage): ClassLike =>
  recover(message, globalHermesMetadata.findTimeout(message.name));
