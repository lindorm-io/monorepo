export interface StandardIdentifier {
  id: string;
  name: string;
  namespace: string;
}

export type AggregateIdentifier = StandardIdentifier;

export type SagaIdentifier = StandardIdentifier;

export type ViewIdentifier = StandardIdentifier;

export interface HandlerIdentifier {
  name: string;
  namespace: string;
}
