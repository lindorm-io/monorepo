import { Constructor } from "@lindorm/types";
import { HandlerIdentifier, ViewIdCallback } from "../types";
import { NameData } from "../utils/private";

export interface IViewIdHandler<C extends Constructor = Constructor> {
  aggregate: HandlerIdentifier;
  event: NameData;
  key: string;
  view: HandlerIdentifier;
  handler: ViewIdCallback<C>;
}
