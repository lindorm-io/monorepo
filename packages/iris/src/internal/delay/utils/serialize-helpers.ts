import type { DelayedEntry } from "../../../types/delay.js";

export const serializeDelayedEntry = (entry: DelayedEntry): string => {
  return JSON.stringify({
    ...entry,
    envelope: {
      ...entry.envelope,
      payload: entry.envelope.payload.toString("base64"),
    },
  });
};

export const deserializeDelayedEntry = (json: string): DelayedEntry => {
  const parsed = JSON.parse(json);
  parsed.envelope.payload = Buffer.from(parsed.envelope.payload, "base64");
  return parsed;
};
