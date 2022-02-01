import { Identity } from "../entity";

export const getDisplayName = (identity: Identity): string | null => {
  const { displayName } = identity;

  if (!displayName.name) return null;

  return `${displayName.name}#${displayName.number.toString().padStart(4, "0")}`;
};
