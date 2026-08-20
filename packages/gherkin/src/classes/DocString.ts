import type { DocStringSettings } from "../types/doc-string-settings.js";

/**
 * A step's DocString argument, delivered in the trailing argument slot. A
 * plain readonly CLASS (the ScenarioInfo pattern: the runner constructs a
 * concrete value, and one exported name serves as both value and type) —
 * deliberately NOT quickpickle's `extends String` trick, where
 * `doc === "expected"` is silently false while `==` works. The body is
 * `content`, explicit and comparable.
 */
export class DocString {
  readonly content: string;
  readonly mediaType?: string;

  constructor(settings: DocStringSettings) {
    this.content = settings.content;
    this.mediaType = settings.mediaType;
  }
}
