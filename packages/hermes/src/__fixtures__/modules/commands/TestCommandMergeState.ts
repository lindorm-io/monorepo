import { Command } from "../../../decorators/index.js";

@Command()
export class TestCommandMergeState {
  public constructor(public readonly input: string) {}
}
