import { NameData } from "../../utils/private";
import { HandlerIdentifier } from "../identifiers";

export type ChecksumEventHandlerOptions = {
  aggregate: HandlerIdentifier;
  event: NameData;
  key: string;
};
