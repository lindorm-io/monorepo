import { Command } from "../../../decorators/index.js";

@Command()
export class TestCommandSetState {
  public constructor(public readonly input: string) {}
}
