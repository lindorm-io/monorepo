import type { MessageMetadata } from "../message/types/metadata.js";

export const resolveIdentifierValue = (
  message: any,
  metadata: MessageMetadata,
): string | null => {
  const identifierField = metadata.fields.find((f) => f.decorator === "IdentifierField");
  if (!identifierField) return null;

  const value = message[identifierField.key];
  if (value == null) return null;

  return String(value);
};
