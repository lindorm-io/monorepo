import type { DeadLetterEntry } from "../../../types/dead-letter.js";

export const serializeDeadLetterEntry = (entry: DeadLetterEntry): string => {
  return JSON.stringify({
    ...entry,
    envelope: {
      ...entry.envelope,
      payload: entry.envelope.payload.toString("base64"),
    },
  });
};

export const deserializeDeadLetterEntry = (json: string): DeadLetterEntry => {
  const parsed = JSON.parse(json);
  parsed.envelope.payload = Buffer.from(parsed.envelope.payload, "base64");
  return parsed;
};
