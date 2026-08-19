import { isArray } from "@lindorm/is";
import type { File, Files } from "formidable";

// formidable builds its `Files` map from the `file` event, which it emits from
// inside the temp file's write-stream flush callback — so both the field-key
// order and each field's array follow whichever file finished writing to disk
// first. Under load those flushes complete out of order (measured: ~25% of
// three-part requests), and the upload mount reads that order straight through
// (`handle-upload` flattens the map, then persists and responds in it), so a
// duplicate name under `overwrite` picked a winner by coin flip.
//
// `fileBegin` is emitted synchronously as the multipart parser reaches each
// part, which IS the order the client sent. Re-key the map by that order so
// every consumer downstream sees the wire order.
export const orderFormidableFiles = (files: Files, order: Array<File>): Files => {
  const rank = new Map<File, number>(order.map((file, index) => [file, index]));

  const entries: Array<[string, File]> = [];
  for (const [name, value] of Object.entries(files)) {
    if (isArray(value)) for (const file of value) entries.push([name, file]);
    else if (value) entries.push([name, value]);
  }

  // A file with no recorded `fileBegin` keeps its relative position at the
  // end — `sort` is stable, so an unranked file is never reordered against
  // another unranked one.
  entries.sort(
    ([, a], [, b]) =>
      (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER),
  );

  const result: Record<string, Array<File>> = {};
  for (const [name, file] of entries) {
    if (result[name]) result[name].push(file);
    else result[name] = [file];
  }
  return result;
};
