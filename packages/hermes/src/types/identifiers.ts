export interface StandardIdentifier {
  id: string;
  name: string;
  context: string;
}

export type AggregateIdentifier = StandardIdentifier;

export type SagaIdentifier = StandardIdentifier;

export type ViewIdentifier = StandardIdentifier;

export interface HandlerIdentifier {
  name: string;
  context: string;
}

export interface HandlerIdentifierMultipleContexts {
  name: string;
  context: Array<string> | string;
}
