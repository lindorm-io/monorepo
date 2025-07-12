import { MessageKit } from "@lindorm/message";
import { Command, Event } from "../../decorators";
import { HermesCommand, HermesEvent } from "../../messages";
import { globalHermesMetadata } from "./global";
import { recoverCommand, recoverEvent } from "./recover-dto";

describe("recoverCommand", () => {
  test("should recover an exact copy of the command", () => {
    @Command()
    class TestRecoverCommand {
      public constructor(
        public readonly one: string,
        public readonly two: number,
      ) {}
    }

    const evt = new TestRecoverCommand("test", 123);

    const kit = new MessageKit({ target: HermesCommand<TestRecoverCommand> });

    const msg = kit.create({
      id: "330b2d1b-b9c9-5b03-91af-ea3f94b655b6",
      aggregate: {
        id: "679b860f-05b0-5f4a-98bf-913d8d9a9ddf",
        name: "test_aggregate",
        namespace: "hermes",
      },
      causationId: "773d51e9-b185-5d1f-b00e-e960edeb6f27",
      correlationId: "c0caa8b9-b741-550b-9481-92cd17325136",
      data: { one: "test", two: 123 },
      delay: 0,
      mandatory: false,
      meta: { userId: "12f50c9b-cda4-572e-b2dd-555871be9de0" },
      name: "test_recover_command",
      timestamp: new Date(),
      version: 1,
    });

    expect(globalHermesMetadata.findCommand(msg.name)).toMatchSnapshot();
    expect(recoverCommand(msg)).toMatchSnapshot();
    expect(recoverCommand(msg)).toEqual(evt);
  });
});

describe("recoverEvent", () => {
  test("should recover an exact copy of the event", () => {
    @Event()
    class TestRecoverEvent {
      public constructor(
        public readonly one: string,
        public readonly two: number,
      ) {}
    }

    const evt = new TestRecoverEvent("test", 123);

    const kit = new MessageKit({ target: HermesEvent<TestRecoverEvent> });

    const msg = kit.create({
      id: "330b2d1b-b9c9-5b03-91af-ea3f94b655b6",
      aggregate: {
        id: "679b860f-05b0-5f4a-98bf-913d8d9a9ddf",
        name: "test_aggregate",
        namespace: "hermes",
      },
      causationId: "773d51e9-b185-5d1f-b00e-e960edeb6f27",
      correlationId: "c0caa8b9-b741-550b-9481-92cd17325136",
      data: { one: "test", two: 123 },
      delay: 0,
      mandatory: false,
      meta: { userId: "12f50c9b-cda4-572e-b2dd-555871be9de0" },
      name: "test_recover_event",
      timestamp: new Date(),
      version: 1,
    });

    expect(globalHermesMetadata.findEvent(msg.name, msg.version)).toMatchSnapshot();
    expect(recoverEvent(msg)).toMatchSnapshot();
    expect(recoverEvent(msg)).toEqual(evt);
  });
});
