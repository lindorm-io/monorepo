/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { GlobalMessageMetadata as GlobalMessageMetadataImpl } from "../classes/private";
import {
  MetaField,
  MetaGenerated,
  MetaHook,
  MetaMessage,
  MetaPriority,
  MetaSchema,
  MetaTopic,
} from "./metadata";

export type GlobalMessageMetadata = {
  fields: Array<MetaField>;
  messages: Array<MetaMessage>;
  generated: Array<MetaGenerated>;
  hooks: Array<MetaHook>;
  priorities: Array<MetaPriority>;
  schemas: Array<MetaSchema>;
  topics: Array<MetaTopic>;
};

export type GlobalThisMessage = typeof globalThis & {
  __lindorm_message__: GlobalMessageMetadataImpl;
};
