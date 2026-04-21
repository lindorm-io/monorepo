import type { MetaField, MetaFieldDecorator, MetaIndex } from "../types/metadata.js";

type AutoIndexSpec = {
  requires: Array<MetaFieldDecorator>;
  unique?: (versionKeys: Array<string>) => boolean;
};

const AUTO_INDEX_SPECS: Array<AutoIndexSpec> = [
  { requires: ["DeleteDate"] },
  { requires: ["DeleteDate", "ExpiryDate"] },
  { requires: ["DeleteDate", "Version"] },
  { requires: ["DeleteDate", "ExpiryDate", "Version"] },
  { requires: ["Scope"] },
  { requires: ["Version"], unique: (vk) => vk.length > 0 },
  { requires: ["VersionStartDate"] },
  { requires: ["VersionStartDate", "VersionEndDate"] },
];

export const generateAutoIndexes = (
  anchorKey: string,
  fields: Array<MetaField>,
  versionKeys: Array<string>,
): Array<MetaIndex> => {
  const indexes: Array<MetaIndex> = [];

  for (const spec of AUTO_INDEX_SPECS) {
    const matched = spec.requires.map((decorator) =>
      fields.find((f) => f.decorator === decorator),
    );

    if (matched.some((f) => !f)) continue;

    indexes.push({
      keys: [
        { key: anchorKey, direction: "asc", nulls: null },
        ...matched.map((f) => ({ key: f!.key, direction: "asc" as const, nulls: null })),
      ],
      include: null,
      name: null,
      unique: spec.unique ? spec.unique(versionKeys) : false,
      concurrent: false,
      sparse: false,
      where: null,
      using: null,
      with: null,
    });
  }

  return indexes;
};
