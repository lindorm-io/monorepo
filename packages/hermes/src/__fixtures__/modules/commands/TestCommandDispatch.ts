import { Command } from "../../../decorators/index.js";

@Command()
export class TestCommandDispatch {
  public constructor(public readonly input: string) {}
}
