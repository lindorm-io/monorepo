/**
 * The two-line anchor block every failure message carries: the source text
 * and its `uri:line:column` position in the feature file. Lines and columns
 * come from the model (parser locations), never from source maps.
 */
export const formatAnchor = (
  text: string,
  uri: string,
  line: number,
  column: number,
): string => `  ${text}\n  at ${uri}:${line}:${column}`;
