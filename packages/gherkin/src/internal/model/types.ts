export type StepType = "Context" | "Action" | "Outcome" | "Unknown";

export type DocStringArgumentModel = {
  kind: "doc-string";
  /**
   * The pickle DocString body VERBATIM — hostile characters included; the
   * emitter's JSON.stringify is what keeps it data rather than code.
   * `<placeholder>` substitution in outline rows came free via compile().
   */
  content: string;
  mediaType?: string;
};

export type DataTableArgumentModel = {
  kind: "data-table";
  /**
   * The pickle table's cell matrix in row order — ARRAYS, never a Record: a
   * `"__proto__"` header cell must survive the baked-literal evaluation as
   * data (the examplesRow ruling). Cells carry `<placeholder>` substitution
   * from compile(), like step text.
   */
  rows: Array<Array<string>>;
};

export type StepArgumentModel = DocStringArgumentModel | DataTableArgumentModel;

export type StepModel = {
  /**
   * The pickle step's DocString or DataTable CONTENT — the runtime
   * materializes it into the step method's trailing argument slot. Absent
   * when the step carries none (the slot is then passed as `undefined`).
   */
  argument?: StepArgumentModel;
  /** The AST step keyword's column — failure anchors render `uri:line:column`. */
  column: number;
  /**
   * The AST step's line, resolved via the pickle step's `astNodeIds[0]` — so a
   * merged Background step anchors to its line in the Background block, not to
   * the scenario it was merged into.
   */
  line: number;
  /** Outline rows carry `<placeholder>`-substituted text. */
  text: string;
  type: StepType;
};

export type ScenarioNode = {
  kind: "scenario";
  /** The `Scenario:` keyword's column — for an outline row, the row's leading `|`. */
  column: number;
  /**
   * ENTRIES, never a `Record`: the transform bakes the model into generated
   * module source as an object literal, where a `"__proto__"` key sets the
   * prototype instead of an own property — the column would silently vanish
   * on evaluation, and a JSON.parse round trip cannot catch it. Only present
   * on outline-row scenarios: `[header, value]` pairs in column order, ready
   * for `Object.fromEntries` (ScenarioInfo.ts). Pinned:
   * gherkin-plugin.test.ts ("__proto__ Examples column").
   */
  examplesRow?: Array<[string, string]>;
  /**
   * A plain scenario anchors to its `Scenario:` line. An outline row anchors
   * to its EXAMPLES ROW line — taken from `row.location.line` during the AST
   * walk (equivalent to resolving `pickle.astNodeIds[1]`, the row's TableRow
   * id) — so each row's test points at the data that produced it rather than
   * at the shared outline header.
   */
  line: number;
  /** The pickle name — outline rows carry `<placeholder>` substitution. */
  name: string;
  /** The enclosing `Rule:` name — absent for a feature-level scenario. */
  ruleName?: string;
  steps: Array<StepModel>;
  /**
   * The pickle's fully inherited tag set (feature → rule → scenario →
   * examples — compile() concatenates all four levels), as authored WITH the
   * `@` prefix: pickle tags and hook tag-expression evaluation both carry it,
   * so the model stores one spelling and only the vitest-tag mapping strips
   * it. Duplicates survive as compile() emits them.
   */
  tags: Array<string>;
};

export type EmptyExamplesNode = {
  kind: "empty-examples";
  /** The `Examples:` keyword's column. */
  column: number;
  /** The `Examples:` keyword line — the authoring error is the empty table. */
  line: number;
  /** The outline's name; an Examples block rarely has one of its own. */
  name: string;
  /**
   * Inherited from the AST (feature → rule → outline → this Examples block),
   * `@` kept — no pickle exists to inherit from. The failing test registers
   * WITH these tags so it goes red exactly when its lane runs under
   * --tagsFilter; a tagless registration would be skipped by EVERY positive
   * filter (measured: an untagged test is skipped under `--tagsFilter x`).
   * Pinned: build-feature-model.test.ts, emit-feature.test.ts.
   */
  tags: Array<string>;
};

export type EmptyScenarioNode = {
  kind: "empty-scenario";
  /** The scenario keyword's column. */
  column: number;
  /**
   * The scenario's own line — also for a zero-step outline, where the defect
   * is the outline having no steps, not any single Examples row.
   */
  line: number;
  name: string;
  /**
   * Inherited from the AST (feature → rule → scenario), `@` kept — the
   * superseded pickles are not consulted. Same rationale as
   * EmptyExamplesNode.tags.
   */
  tags: Array<string>;
};

export type RuleNode = {
  children: Array<SuiteNode>;
  kind: "rule";
  line: number;
  name: string;
};

export type SuiteNode = RuleNode | ScenarioNode | EmptyExamplesNode | EmptyScenarioNode;

export type ParseErrorEntry = {
  column?: number;
  /** A line in the FEATURE FILE — carried from the parser exception's location, never from a source map. */
  line?: number;
  message: string;
};

export type ParseErrorModel = {
  errors: Array<ParseErrorEntry>;
  kind: "parse-error";
  uri: string;
};

export type FeatureSuiteModel = {
  children: Array<SuiteNode>;
  /**
   * The number of test() registrations the runtime makes from this model —
   * one per scenario, empty-examples and empty-scenario node. Counted from
   * the finished tree (count-expected-tests.ts) so the emitter's own walk has
   * an independent number to be checked against (the structural invariant:
   * registered tests must equal this).
   */
  expectedTests: number;
  kind: "feature";
  line: number;
  name: string;
  /**
   * The UNION of the RETAINED pickles' tag sets — the set @BeforeFeature /
   * @AfterFeature tag expressions evaluate against. Derived from the PICKLES,
   * never the AST feature tags alone, which would drop scenario- and
   * examples-level tags; pickles the settings `tags` expression excluded
   * contribute nothing — their scenarios do not exist, so a feature hook
   * gated on their tags must not fire (pinned: build-feature-model.test.ts).
   * Deduplicated, first-appearance order across pickles in compile order.
   */
  tags: Array<string>;
  uri: string;
};

export type EmptyFeatureModel = {
  kind: "empty";
  /**
   * `null` when the file parsed to no feature at all (empty or comment-only
   * file — gherkinDocument.feature is undefined). A named feature with zero
   * runnable children keeps its name for the skipped suite.
   */
  name: string | null;
  uri: string;
};

/**
 * Pure JSON-serializable data — the transform JSON.stringifies it into
 * generated module source, so nothing here may hold a function, a class
 * instance or an id from the parser.
 */
export type FeatureModel = ParseErrorModel | FeatureSuiteModel | EmptyFeatureModel;
