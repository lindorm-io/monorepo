import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { COAP_CONTENT_FORMATS } from "./coap-content-formats.js";

/** The committed IANA registry snapshot — the only external input the table has. */
const SNAPSHOT = new URL(
  "../../__fixtures__/iana/coap-content-formats.csv",
  import.meta.url,
);

/**
 * The snapshot's provenance, CHECKED rather than asserted in prose. A fixture a
 * test derives from is only as good as the claim about where it came from, and
 * that claim is otherwise checkable against nothing.
 */
const SOURCE = {
  url: "https://www.iana.org/assignments/core-parameters/content-formats.csv",
  fetchedAt: "2026-10-03",
  sha256: "1ee47f086c2043513cdd94a8868ffcb1dae5a85107168139400284ea242b97cb",
};

/** One record's fields (RFC 4180 §2): a quoted field may hold a comma, and `""` inside one is a quote. */
const fieldsOf = (record: string): Array<string> => {
  const fields: Array<string> = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < record.length; index += 1) {
    const char = record[index];

    if (quoted && char === '"' && record[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }

  fields.push(field);

  return fields;
};

type Row = { contentType: string; contentCoding: string; id: string };

const HEADER = ["Content Type", "Content Coding", "Media Type", "ID", "Reference"];

const header = (): Array<string> =>
  fieldsOf(readFileSync(SNAPSHOT, "utf8").trim().split("\r\n")[0]!);

const rows = (): Array<Row> => {
  const [, ...records] = readFileSync(SNAPSHOT, "utf8").trim().split("\r\n");

  return records.map((record) => {
    const [contentType, contentCoding, , id] = fieldsOf(record);

    return { contentType: contentType!, contentCoding: contentCoding!, id: id! };
  });
};

/** A row naming ONE ID; the rest name a range (`1-15`). */
const isSingleId = (row: Row): boolean => /^\d+$/.test(row.id);

/** The note IANA trails a provisional registration's `Content Type` cell with. */
const PROVISIONAL_NOTE = / \(TEMPORARY - [^)]*\)$/;

/** The media type a `Content Type` cell names: the cell, less a provisional note. */
const mediaTypeOf = (row: Row): string => row.contentType.replace(PROVISIONAL_NOTE, "");

/**
 * A cell that names a media type: one carrying the `/` between type and subtype
 * (RFC 9052 §3.1). `Unassigned` and the `Reserved …` cells carry none.
 */
const namesMediaType = (row: Row): boolean => mediaTypeOf(row).includes("/");

/** Every row the table must carry: one ID, a media type, no content coding. */
const concrete = (): Array<[id: number, contentType: string]> =>
  rows()
    .filter((row) => isSingleId(row) && namesMediaType(row) && row.contentCoding === "")
    .map((row) => [Number(row.id), mediaTypeOf(row)]);

const tableIds = (): Array<number> => Object.keys(COAP_CONTENT_FORMATS).map(Number);

/**
 * The CoAP Content-Formats table `cty` is read through, and the bindings that
 * keep it equal to the registry it mirrors.
 */
describe("COAP_CONTENT_FORMATS", () => {
  test("the committed IANA snapshot is the file this suite claims it is", () => {
    const digest = createHash("sha256").update(readFileSync(SNAPSHOT)).digest("hex");

    expect(
      digest,
      `the snapshot no longer matches the sha256 recorded for ${SOURCE.url} (taken ${SOURCE.fetchedAt}) — re-derive the table and update both`,
    ).toBe(SOURCE.sha256);
  });

  test("every record in the snapshot parses to the registry's five columns", () => {
    expect(header()).toEqual(HEADER);
    expect(rows().length).toBeGreaterThan(0);
    expect(
      readFileSync(SNAPSHOT, "utf8")
        .trim()
        .split("\r\n")
        .filter((record) => fieldsOf(record).length !== HEADER.length),
    ).toEqual([]);
  });

  test("every un-coded ID whose cell names a media type is in the table with that media type", () => {
    const expected = concrete();

    expect(expected.length).toBeGreaterThan(0);
    expect(expected.filter(([id, type]) => COAP_CONTENT_FORMATS[id] !== type)).toEqual(
      [],
    );
  });

  test("a provisional registration's note is in no media type the table carries", () => {
    const provisional = rows().filter(
      (row) => isSingleId(row) && PROVISIONAL_NOTE.test(row.contentType),
    );

    expect(provisional.length).toBeGreaterThan(0);
    expect(
      Object.values(COAP_CONTENT_FORMATS).filter((type) => type.includes("TEMPORARY")),
    ).toEqual([]);
  });

  test("the table carries no ID the snapshot does not give it", () => {
    const expected = new Set(concrete().map(([id]) => id));

    expect(tableIds().filter((id) => !expected.has(id))).toEqual([]);
  });

  test("no ID whose row carries a content coding is in the table", () => {
    const coded = rows()
      .filter((row) => isSingleId(row) && row.contentCoding !== "")
      .map((row) => Number(row.id));

    expect(coded.length).toBeGreaterThan(0);
    expect(coded.filter((id) => Object.hasOwn(COAP_CONTENT_FORMATS, id))).toEqual([]);
  });

  test("no Unassigned or Reserved cell names a media type, in a range or on its own row", () => {
    const placeholders = rows().filter((row) =>
      /^(Unassigned|Reserved)\b/.test(row.contentType),
    );

    expect(placeholders.some((row) => row.contentType.startsWith("Unassigned"))).toBe(
      true,
    );
    expect(placeholders.some((row) => row.contentType.startsWith("Reserved"))).toBe(true);
    expect(placeholders.filter(namesMediaType)).toEqual([]);
  });

  test("no single ID whose cell names no media type is in the table", () => {
    const placeholders = rows()
      .filter((row) => isSingleId(row) && !namesMediaType(row))
      .map((row) => Number(row.id));

    expect(placeholders.length).toBeGreaterThan(0);
    expect(placeholders.filter((id) => Object.hasOwn(COAP_CONTENT_FORMATS, id))).toEqual(
      [],
    );
  });
});
