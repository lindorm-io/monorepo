export type ParameterTypeOptions = {
  /**
   * Offer this parameter type to the snippet generator. Defaults to `false`: a
   * loose regexp offered for snippets makes the generator emit one candidate
   * per matching word. Opt in for a tight regexp.
   */
  useForSnippets?: boolean;
};
