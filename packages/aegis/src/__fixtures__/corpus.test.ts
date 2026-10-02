import { readFileSync } from "node:fs";
import MockDate from "mockdate";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { CBOR_TAG } from "./inspect-token.js";
import { CORPUS_CASES } from "./corpus.js";
import {
  buildRawCorpus,
  canonicalJson,
  canonicalTree,
  CORPUS_GOLDEN,
  differingPaths,
  isCoveredBy,
  normaliseCorpus,
  normaliseEntry,
  placeholderPaths,
  type CorpusRecord,
  type RawCorpusEntry,
} from "./run-corpus.js";

/**
 * The corpus's own proof, and the regression gate it exists for.
 *
 * `corpus.json` is the committed record of every token the table in `corpus.ts`
 * asks aegis for, and a fresh build must equal it. That gate is worth exactly
 * what the record's reproducibility is worth: if the same tree produced two
 * different records, a failure could not tell a change from a re-run. So the
 * suite proves four separate things:
 *
 *   1. TWO INDEPENDENT PASSES AGREE — the whole corpus, built twice, canonically
 *      identical. That is the completeness half of the normalisation: an
 *      irreproducible field nobody declared shows up here as a diff.
 *   2. EVERY NORMALISED FIELD IS ACTUALLY RANDOM — proved by DIFFERENCE, against
 *      two independently produced tokens for the same row. That is the
 *      conservatism half: a rule that normalises a DETERMINISTIC field blinds
 *      the corpus to a real change and is caught right here.
 *   3. THE CORPUS IS NON-TRIVIAL AND STRUCTURALLY SANE — every declared row
 *      produced a token, and each token is the shape its wire says it is.
 *   4. A FRESH BUILD EQUALS THE COMMITTED RECORD — compared as parsed values, so
 *      the file's layout is prettier's business and never this gate's.
 */

describe("wire corpus", () => {
  // ⚠ TWO SEPARATE BUILDS, each with its own deployment, its own keys in the
  // vault and its own crypto calls — never one build compared with itself. A
  // same-object comparison would pass for a corpus made entirely of fresh random
  // bytes, which is the exact failure the determinism tests exist to exclude.
  // Every test that needs a build reads this one pair, so a run makes exactly two.
  let left: ReadonlyArray<RawCorpusEntry>;
  let right: ReadonlyArray<RawCorpusEntry>;

  beforeAll(async () => {
    left = await buildRawCorpus();
    right = await buildRawCorpus();
  }, 60_000); // two whole-corpus builds; a CPU-starved runner must not fail the hook

  afterAll(() => {
    MockDate.reset();
  });

  describe("determinism", () => {
    test("two independent passes produce byte-identical canonical JSON", () => {
      expect(canonicalJson(normaliseCorpus(right))).toEqual(
        canonicalJson(normaliseCorpus(left)),
      );
    });

    test("every normalised field is one that genuinely moves between two tokens", () => {
      expect(right).toHaveLength(left.length);

      for (const [index, first] of left.entries()) {
        const second = right[index];

        expect(second.name).toEqual(first.name);

        const moved = differingPaths(canonicalTree(first), canonicalTree(second));
        const normalised = placeholderPaths(canonicalTree(normaliseEntry(first)));

        // Every field that MOVED must be covered by a normalisation rule —
        // otherwise the corpus is irreproducible and rule 1 above is a fluke of
        // this run.
        const uncovered = moved.filter(
          (path) => !normalised.some((rule) => isCoveredBy(path, rule)),
        );

        expect({ case: first.name, uncovered }).toEqual({
          case: first.name,
          uncovered: [],
        });

        // …and every rule must have something to cover. A rule over a
        // DETERMINISTIC field would silently erase a real byte-level change from
        // the corpus, so it fails here rather than being discovered later by its
        // absence.
        const unjustified = normalised.filter(
          (rule) => !moved.some((path) => isCoveredBy(path, rule)),
        );

        expect({ case: first.name, unjustified }).toEqual({
          case: first.name,
          unjustified: [],
        });
      }
    });

    test("a row declaring no randomness reproduces its token byte for byte", () => {
      const deterministic = left.filter(
        (entry) => !entry.randomness.encrypted && !entry.randomness.signature,
      );

      // The corpus is only a byte-level record where SOME row is byte-level. If
      // this ever empties out, the record has quietly become length-and-shape
      // only, and the assertion below would pass over nothing.
      expect(deterministic.length).toBeGreaterThanOrEqual(8);

      for (const entry of deterministic) {
        const other = right.find((candidate) => candidate.name === entry.name);

        expect(other?.token).toEqual(entry.token);
      }
    });
  });

  describe("census", () => {
    test("the corpus is non-trivial and every declared row produced a token", () => {
      expect(CORPUS_CASES.length).toBeGreaterThanOrEqual(40);
      expect(left).toHaveLength(CORPUS_CASES.length);

      // Order and identity, not merely count: a row that threw would have
      // aborted the build, but a row that produced ANOTHER row's token would not.
      expect(left.map((entry) => entry.name)).toEqual(
        CORPUS_CASES.map((kase) => kase.name),
      );

      for (const entry of left) {
        expect(entry.token.length).toBeGreaterThan(0);
      }
    });

    test("every row name is unique", () => {
      const names = CORPUS_CASES.map((kase) => kase.name);

      expect(new Set(names).size).toEqual(names.length);
    });

    test("both wires, all three verbs and every emitted format are represented", () => {
      expect(new Set(left.map((entry) => entry.wire))).toEqual(new Set(["jose", "cose"]));
      expect(new Set(left.map((entry) => entry.verb))).toEqual(
        new Set(["mint", "sign", "encrypt"]),
      );
      // Every one of the seven appears as the OUTERMOST container of some row.
      // `format` alone does not cover `jwe`/`cwe` from a sign-then-encrypt —
      // those rows report the signed token's kind and name the envelope under
      // `wrapper` — so the union is over the outermost of each row.
      expect(
        new Set(left.map((entry) => entry.reportedWrapper ?? entry.reportedFormat)),
      ).toEqual(new Set(["jwt", "jws", "jwe", "cwt", "cwm", "cws", "cwe"]));
    });
  });

  describe("structure", () => {
    test("a JOSE row is the compact serialisation its format claims", () => {
      for (const entry of left.filter((candidate) => candidate.wire === "jose")) {
        if (entry.inspection.wire !== "jose") {
          throw new Error(`the row "${entry.name}" reports the wrong wire`);
        }

        // ⚠ The OUTERMOST container decides the serialisation, and that is the
        // WRAPPER when there is one: a JWT inside a JWE reports `format: "jwt"`
        // and is still five parts on the wire. Reading `format` alone would
        // expect three and describe the token rather than the bytes.
        const outermost = entry.reportedWrapper ?? entry.reportedFormat;
        const expected = outermost === "jwe" ? 5 : 3;

        expect({ case: entry.name, parts: entry.inspection.partCount }).toEqual({
          case: entry.name,
          parts: expected,
        });
      }
    });

    test("a COSE row decodes under the tag chain its format claims", () => {
      // A CWT is framed in tag 61 and the structures carry their own tags inside
      // it (RFC 8392 §6, RFC 9052 §2). A CWS is opaque content in a CWT frame, so
      // it carries the same outer tag — what tells the formats apart is the inner
      // one.
      //
      // ⚠ `cws` is the one format whose structure is decided by the KEY and not by
      // the name: a COSE_Sign1 carries a digital signature, which a shared secret
      // cannot produce, so an opaque COSE token signed with an `HS*` key is a
      // COSE_Mac0. The named `cwm` format is the claims-bearing twin of that, not
      // the only way to reach it. RFC 9052 §4.2, RFC 9052 §6.2.
      const structureTag = (entry: {
        reportedFormat: string;
        reportedWrapper?: string;
        signAlgorithm?: string;
      }) => {
        switch (entry.reportedWrapper ?? entry.reportedFormat) {
          case "cwe":
            return CBOR_TAG.encrypt0;
          case "cwm":
            return CBOR_TAG.mac0;
          case "cwt":
            return CBOR_TAG.sign1;
          case "cws":
            return entry.signAlgorithm?.startsWith("HS") === true
              ? CBOR_TAG.mac0
              : CBOR_TAG.sign1;
          default:
            throw new Error(
              `no COSE structure is declared for "${entry.reportedWrapper ?? entry.reportedFormat}"`,
            );
        }
      };

      const coseRows = left.filter((candidate) => candidate.wire === "cose");

      expect(coseRows.length).toBeGreaterThanOrEqual(15);

      for (const entry of coseRows) {
        if (entry.inspection.wire !== "cose") {
          throw new Error(`the row "${entry.name}" reports the wrong wire`);
        }

        const inner = entry.inspection.tags[entry.inspection.tags.length - 1];

        expect({ case: entry.name, tag: inner }).toEqual({
          case: entry.name,
          tag: structureTag(entry),
        });
      }
    });

    test("an encrypted row's payload is unreadable and says so", () => {
      const sealed = left.filter((entry) => entry.randomness.encrypted);

      expect(sealed.length).toBeGreaterThanOrEqual(8);

      for (const entry of sealed) {
        // The inspector's own claim, verified rather than assumed: an exclusion
        // assertion over an empty container passes without checking anything, so
        // a corpus that trusted `readable: false` would be trusting the very
        // thing it was told to check.
        expect({ case: entry.name, readable: entry.inspection.payload.readable }).toEqual(
          { case: entry.name, readable: false },
        );
      }
    });

    test("a signed structured row carries readable claims including its declared token id", () => {
      const structured = left.filter(
        (entry) => entry.verb === "mint" && !entry.randomness.encrypted,
      );

      expect(structured.length).toBeGreaterThanOrEqual(15);

      for (const entry of structured) {
        expect({ case: entry.name, readable: entry.inspection.payload.readable }).toEqual(
          { case: entry.name, readable: true },
        );
      }
    });
  });

  describe("golden", () => {
    // Regenerate on purpose, from the package root, and review the diff it makes:
    //   npm run corpus -- src/__fixtures__/corpus.json
    test("a fresh build equals the committed record, row by row", () => {
      const { cases, ...envelope } = normaliseCorpus(left);
      const { cases: goldenCases, ...goldenEnvelope } = JSON.parse(
        readFileSync(CORPUS_GOLDEN, "utf8"),
      ) as CorpusRecord;

      expect(envelope).toEqual(goldenEnvelope);
      expect(cases.map((row) => row.name)).toEqual(goldenCases.map((row) => row.name));

      for (const [index, row] of cases.entries()) {
        expect(canonicalTree(row), `the corpus row "${row.name}"`).toEqual(
          goldenCases[index],
        );
      }
    });
  });

  describe("rendering", () => {
    test("the canonical rendering keeps an integer COSE label apart from a text one", () => {
      // An int label and the tstr that spells it are different labels
      // (RFC 9052 §1.5). A plain object would merge the two into one key, and the
      // corpus would stop being able to report the difference the inspector went
      // out of its way to preserve.
      const labels = new Map<number | string, unknown>([
        ["4", "text"],
        [4, "int"],
      ]);

      expect(canonicalTree(labels)).toEqual({
        $map: [
          [{ $int: 4 }, "int"],
          [{ $text: "4" }, "text"],
        ],
      });
    });

    test("the canonical rendering states an undefined member rather than dropping it", () => {
      expect(canonicalJson({ present: 1, absent: undefined })).toEqual(
        JSON.stringify({ absent: { $undefined: true }, present: 1 }, null, 2),
      );
    });

    test("the canonical rendering tags bytes with their length", () => {
      expect(canonicalTree(Buffer.from("beef", "hex"))).toEqual({
        $bytes: "beef",
        $length: 2,
      });
    });

    test("the canonical rendering sorts object keys, so key order never moves a corpus", () => {
      expect(canonicalJson({ b: 1, a: 2 })).toEqual(canonicalJson({ a: 2, b: 1 }));
    });
  });
});

/**
 * A guard on the evidence machinery itself. `differingPaths` is what proves every
 * normalisation rule is earned, so a version of it that reported nothing would
 * make that proof vacuous — the same shape of vacuous pass the inspector's
 * `readable: false` exists to prevent.
 */
describe("path evidence", () => {
  test("differingPaths reports a moved leaf, an added one and a removed one", () => {
    const left = canonicalTree({ same: 1, moved: "a", onlyLeft: true });
    const right = canonicalTree({ same: 1, moved: "b", onlyRight: true });

    expect(differingPaths(left, right)).toEqual(["moved", "onlyLeft", "onlyRight"]);
  });

  test("differingPaths reports nothing for two equal trees", () => {
    const tree = { a: [1, 2], b: { c: "d" } };

    expect(differingPaths(canonicalTree(tree), canonicalTree(tree))).toEqual([]);
  });

  test("a placeholder path covers the byte leaves that sit beneath it", () => {
    expect(isCoveredBy("header.iv.$bytes", "header.iv")).toBe(true);
    expect(isCoveredBy("header.ivory", "header.iv")).toBe(false);
  });

  test("placeholderPaths finds only the normalised leaves", () => {
    const entry = canonicalTree({
      token: "<random:120 chars>",
      note: "a note that merely mentions <random: something",
      parts: ["header", "payload", "<random:64 bytes>"],
    });

    expect(placeholderPaths(entry)).toEqual(["parts[2]", "token"]);
  });
});
