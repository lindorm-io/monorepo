import { Timeout } from "../../../decorators";

@Timeout()
export class TestTimeoutThrows {
  public constructor(public readonly input: any) {}
}
