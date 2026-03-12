import { dispatchSubscribers } from "./dispatch-subscribers";
import type {
  IEntitySubscriber,
  InsertEvent,
  LoadEvent,
} from "../../../interfaces/EntitySubscriber";

class EntityA {
  id = "a";
}
class EntityB {
  id = "b";
}

describe("dispatchSubscribers", () => {
  test("should call matching subscriber for the correct event", async () => {
    const afterInsertSpy = jest.fn();
    const subscriber: IEntitySubscriber = {
      listenTo: () => [EntityA],
      afterInsert: afterInsertSpy,
    };

    const event: InsertEvent = {
      entity: new EntityA(),
      metadata: {} as any,
      connection: null,
    };
    await dispatchSubscribers("afterInsert", event, EntityA, [subscriber]);

    expect(afterInsertSpy).toHaveBeenCalledTimes(1);
    expect(afterInsertSpy).toHaveBeenCalledWith(event);
  });

  test("should skip subscriber when entity does not match listenTo", async () => {
    const afterInsertSpy = jest.fn();
    const subscriber: IEntitySubscriber = {
      listenTo: () => [EntityA],
      afterInsert: afterInsertSpy,
    };

    const event: InsertEvent = {
      entity: new EntityB(),
      metadata: {} as any,
      connection: null,
    };
    await dispatchSubscribers("afterInsert", event, EntityB, [subscriber]);

    expect(afterInsertSpy).not.toHaveBeenCalled();
  });

  test("should match all entities when listenTo is undefined", async () => {
    const afterLoadSpy = jest.fn();
    const subscriber: IEntitySubscriber = {
      afterLoad: afterLoadSpy,
    };

    const event: LoadEvent = {
      entity: new EntityB(),
      metadata: {} as any,
      connection: null,
    };
    await dispatchSubscribers("afterLoad", event, EntityB, [subscriber]);

    expect(afterLoadSpy).toHaveBeenCalledTimes(1);
  });

  test("should match all entities when listenTo returns empty array", async () => {
    const beforeInsertSpy = jest.fn();
    const subscriber: IEntitySubscriber = {
      listenTo: () => [],
      beforeInsert: beforeInsertSpy,
    };

    const event: InsertEvent = {
      entity: new EntityA(),
      metadata: {} as any,
      connection: null,
    };
    await dispatchSubscribers("beforeInsert", event, EntityA, [subscriber]);

    expect(beforeInsertSpy).toHaveBeenCalledTimes(1);
  });

  test("should call subscribers in registration order", async () => {
    const callOrder: Array<string> = [];

    const sub1: IEntitySubscriber = {
      afterInsert: () => {
        callOrder.push("sub1");
      },
    };
    const sub2: IEntitySubscriber = {
      afterInsert: () => {
        callOrder.push("sub2");
      },
    };
    const sub3: IEntitySubscriber = {
      afterInsert: () => {
        callOrder.push("sub3");
      },
    };

    const event: InsertEvent = {
      entity: new EntityA(),
      metadata: {} as any,
      connection: null,
    };
    await dispatchSubscribers("afterInsert", event, EntityA, [sub1, sub2, sub3]);

    expect(callOrder).toEqual(["sub1", "sub2", "sub3"]);
  });

  test("should await async subscriber handlers", async () => {
    const callOrder: Array<string> = [];

    const sub1: IEntitySubscriber = {
      afterInsert: async () => {
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push("sub1");
      },
    };
    const sub2: IEntitySubscriber = {
      afterInsert: () => {
        callOrder.push("sub2");
      },
    };

    const event: InsertEvent = {
      entity: new EntityA(),
      metadata: {} as any,
      connection: null,
    };
    await dispatchSubscribers("afterInsert", event, EntityA, [sub1, sub2]);

    expect(callOrder).toEqual(["sub1", "sub2"]);
  });

  test("should propagate errors from subscriber handlers", async () => {
    const subscriber: IEntitySubscriber = {
      afterInsert: () => {
        throw new Error("subscriber error");
      },
    };

    const event: InsertEvent = {
      entity: new EntityA(),
      metadata: {} as any,
      connection: null,
    };

    await expect(
      dispatchSubscribers("afterInsert", event, EntityA, [subscriber]),
    ).rejects.toThrow("subscriber error");
  });

  test("should propagate errors from async subscriber handlers", async () => {
    const subscriber: IEntitySubscriber = {
      afterInsert: async () => {
        throw new Error("async subscriber error");
      },
    };

    const event: InsertEvent = {
      entity: new EntityA(),
      metadata: {} as any,
      connection: null,
    };

    await expect(
      dispatchSubscribers("afterInsert", event, EntityA, [subscriber]),
    ).rejects.toThrow("async subscriber error");
  });

  test("should skip events the subscriber does not implement", async () => {
    const afterInsertSpy = jest.fn();
    const subscriber: IEntitySubscriber = {
      afterInsert: afterInsertSpy,
      // no beforeInsert defined
    };

    const event: InsertEvent = {
      entity: new EntityA(),
      metadata: {} as any,
      connection: null,
    };
    await dispatchSubscribers("beforeInsert", event, EntityA, [subscriber]);

    expect(afterInsertSpy).not.toHaveBeenCalled();
  });

  test("should handle empty subscriber list", async () => {
    const event: InsertEvent = {
      entity: new EntityA(),
      metadata: {} as any,
      connection: null,
    };
    await expect(
      dispatchSubscribers("afterInsert", event, EntityA, []),
    ).resolves.toBeUndefined();
  });

  test("should support subscriber listening to multiple entity classes", async () => {
    const afterInsertSpy = jest.fn();
    const subscriber: IEntitySubscriber = {
      listenTo: () => [EntityA, EntityB],
      afterInsert: afterInsertSpy,
    };

    const eventA: InsertEvent = {
      entity: new EntityA(),
      metadata: {} as any,
      connection: null,
    };
    const eventB: InsertEvent = {
      entity: new EntityB(),
      metadata: {} as any,
      connection: null,
    };

    await dispatchSubscribers("afterInsert", eventA, EntityA, [subscriber]);
    await dispatchSubscribers("afterInsert", eventB, EntityB, [subscriber]);

    expect(afterInsertSpy).toHaveBeenCalledTimes(2);
  });
});
