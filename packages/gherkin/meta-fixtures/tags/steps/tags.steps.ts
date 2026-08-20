import { Binding, Given } from "../../../src/index.js";

/**
 * The child's stdout is the meta-suite's oracle: a sentinel proves the
 * scenario RAN; its absence under transform-time selection proves the
 * scenario never existed (vs --tagsFilter, where it exists and skips).
 */
const sentinel = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

@Binding()
export class TagSteps {
  @Given("a noted step {string}")
  note(value: string): void {
    sentinel(`META_SENTINEL_NOTE_${value}`);
  }
}
