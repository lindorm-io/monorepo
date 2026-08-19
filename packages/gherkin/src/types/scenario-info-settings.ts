export type ScenarioInfoSettings = {
  featureName: string;
  featureUri: string;
  ruleName?: string;
  scenarioName: string;
  tags: Array<string>;
  /**
   * `[header, value]` ENTRIES in column order, never a `Record`: the settings
   * travel through generated module source as an object literal, where a
   * `"__proto__"` key would set the prototype instead of an own property and
   * the column would silently vanish. ScenarioInfo materializes the Record
   * via `Object.fromEntries`, whose own-property semantics keep such a key.
   */
  examplesRow?: Array<[string, string]>;
  line: number;
};
