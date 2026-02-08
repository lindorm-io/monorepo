import { EntityKitError } from "../errors";

type Options = {
  namespace?: string | null;
  separator?: string;
};

export const getJoinCollectionName = (joinTable: string, options: Options): string => {
  const namespace = options.namespace;

  if (namespace === "system") {
    throw new EntityKitError("The 'system' namespace is reserved for internal use");
  }

  const sep = options.separator ?? ".";
  const n = namespace ? `${namespace}${sep}` : "";
  const name = `${n}join${sep}${joinTable}`;

  if (name.length > 120) {
    throw new EntityKitError(`Join collection name exceeds 120 characters: ${name}`);
  }

  return name;
};
