import { Command } from "../../../decorators";

@Command()
export class TestCommandCreate {
  public constructor(public readonly input: any) {}
}
