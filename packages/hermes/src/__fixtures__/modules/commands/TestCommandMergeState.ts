import { Command } from "../../../decorators";

@Command()
export class TestCommandMergeState {
  public constructor(public readonly input: any) {}
}
