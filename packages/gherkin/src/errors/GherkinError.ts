import { LindormError } from "@lindorm/errors";

export class GherkinError extends LindormError {
  static readonly namespace = "gherkin";
}
