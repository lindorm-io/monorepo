type HermesEventDomain = "saga" | "view" | "checksum";

export type HermesEventName = HermesEventDomain | `${HermesEventDomain}.${string}`;
