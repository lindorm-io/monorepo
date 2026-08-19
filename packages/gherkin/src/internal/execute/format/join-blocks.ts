/**
 * Joins message blocks with blank lines, dropping empty blocks — so an
 * optional block (the remaining-steps line at zero) vanishes without leaving
 * a dangling blank line.
 */
export const joinBlocks = (blocks: Array<string>): string =>
  blocks.filter((block) => block.length > 0).join("\n\n");
