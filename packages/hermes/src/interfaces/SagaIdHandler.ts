import { Constructor } from "@lindorm/types";
import { HandlerIdentifier, SagaIdCallback } from "../types";
import { NameData } from "../utils/private";

export interface ISagaIdHandler<C extends Constructor = Constructor> {
  aggregate: HandlerIdentifier;
  event: NameData;
  saga: HandlerIdentifier;
  handler: SagaIdCallback<C>;
}
