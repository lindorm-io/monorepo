export type IndexDirection = "asc" | "desc";

export type NamespaceOptions = {
  namespace?: string | null;
};

export type ScopedName = {
  namespace: string | null;
  name: string;
  type: string;
  parts: Array<string>;
};

export type SaveStrategy = "insert" | "update" | "unknown";

export type UpdateStrategy = "update" | "version";
