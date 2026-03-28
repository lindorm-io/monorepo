import {
  stageAbstractMessage,
  stageBroadcast,
  stageCompressed,
  stageDeadLetter,
  stageEncrypted,
  stageField,
  stageGenerated,
  stageHeader,
  stageHook,
  stageMessage,
  stageNamespace,
  stagePersistent,
  stagePriority,
  stageRetry,
  stageFieldModifier,
  stageTopic,
  stageTransform,
  stageVersion,
  stageExpiry,
} from "./stage-metadata";

describe("stage-metadata", () => {
  describe("ensureOwnArray (via stageField)", () => {
    it("should create own property and not pollute prototype", () => {
      const parent: any = {};
      parent.fields = [{ key: "parentField", decorator: "Field" }];

      const child: any = Object.create(parent);

      stageField(child, {
        key: "childField",
        decorator: "Field",
        default: null,
        enum: null,
        max: null,
        min: null,
        nullable: false,
        optional: false,
        schema: null,
        transform: null,
        type: "string",
      });

      expect(Object.hasOwn(child, "fields")).toBe(true);
      expect(child.fields).toHaveLength(1);
      expect(child.fields[0].key).toBe("childField");
      expect(parent.fields).toHaveLength(1);
      expect(parent.fields[0].key).toBe("parentField");
    });
  });

  describe("array stage functions", () => {
    let metadata: any;

    beforeEach(() => {
      metadata = {};
    });

    it("should accumulate fields", () => {
      const field1: any = { key: "a", decorator: "Field" };
      const field2: any = { key: "b", decorator: "Field" };

      stageField(metadata, field1);
      stageField(metadata, field2);

      expect(metadata.fields).toMatchSnapshot();
    });

    it("should accumulate generated", () => {
      stageGenerated(metadata, {
        key: "id",
        strategy: "uuid",
        length: null,
        max: null,
        min: null,
      });
      stageGenerated(metadata, {
        key: "ts",
        strategy: "date",
        length: null,
        max: null,
        min: null,
      });

      expect(metadata.generated).toMatchSnapshot();
    });

    it("should accumulate headers", () => {
      stageHeader(metadata, { key: "userId", headerName: "x-user-id" });
      stageHeader(metadata, { key: "traceId", headerName: "x-trace-id" });

      expect(metadata.headers).toMatchSnapshot();
    });

    it("should accumulate hooks", () => {
      const cb1 = () => {};
      const cb2 = () => {};
      stageHook(metadata, { decorator: "OnCreate", callback: cb1 });
      stageHook(metadata, { decorator: "BeforePublish", callback: cb2 });

      expect(metadata.hooks).toHaveLength(2);
      expect(metadata.hooks[0].decorator).toBe("OnCreate");
      expect(metadata.hooks[1].decorator).toBe("BeforePublish");
    });

    it("should accumulate field modifiers", () => {
      stageFieldModifier(metadata, { key: "a", decorator: "Min", min: 0 });
      stageFieldModifier(metadata, { key: "a", decorator: "Max", max: 100 });

      expect(metadata.fieldModifiers).toHaveLength(2);
      expect(metadata.fieldModifiers[0].decorator).toBe("Min");
      expect(metadata.fieldModifiers[1].decorator).toBe("Max");
    });

    it("should accumulate transforms", () => {
      const t1 = {
        key: "a",
        transform: { to: (v: unknown) => v, from: (v: unknown) => v },
      };
      const t2 = {
        key: "b",
        transform: { to: (v: unknown) => v, from: (v: unknown) => v },
      };
      stageTransform(metadata, t1);
      stageTransform(metadata, t2);

      expect(metadata.transforms).toHaveLength(2);
      expect(metadata.transforms[0].key).toBe("a");
      expect(metadata.transforms[1].key).toBe("b");
    });
  });

  describe("singleton stage functions", () => {
    let metadata: any;

    beforeEach(() => {
      metadata = {};
    });

    it("should set message", () => {
      stageMessage(metadata, { decorator: "Message", name: "UserCreated" });

      expect(metadata.message).toMatchSnapshot();
    });

    it("should set __abstract and stage message", () => {
      stageAbstractMessage(metadata, {
        decorator: "AbstractMessage",
        name: "BaseEvent",
      });

      expect(metadata.__abstract).toBe(true);
      expect(metadata.message).toMatchSnapshot();
    });

    it("should set topic", () => {
      const topic = { callback: (msg: any) => "user-events" };
      stageTopic(metadata, topic);

      expect(metadata.topic).toBe(topic);
    });

    it("should set priority", () => {
      stagePriority(metadata, 5);

      expect(metadata.priority).toBe(5);
    });

    it("should set encrypted", () => {
      stageEncrypted(metadata, {
        predicate: { algorithm: "AES", purpose: "encryption" } as any,
      });

      expect(metadata.encrypted).toMatchSnapshot();
    });

    it("should set compressed", () => {
      stageCompressed(metadata, { algorithm: "gzip" });

      expect(metadata.compressed).toMatchSnapshot();
    });

    it("should set deadLetter", () => {
      stageDeadLetter(metadata);

      expect(metadata.deadLetter).toBe(true);
    });

    it("should set persistent", () => {
      stagePersistent(metadata);

      expect(metadata.persistent).toBe(true);
    });

    it("should set broadcast", () => {
      stageBroadcast(metadata);

      expect(metadata.broadcast).toBe(true);
    });

    it("should set retry", () => {
      stageRetry(metadata, {
        maxRetries: 5,
        strategy: "exponential",
        delay: 1000,
        delayMax: 30000,
        multiplier: 2,
        jitter: false,
      });

      expect(metadata.retry).toMatchSnapshot();
    });

    it("should set expiry", () => {
      stageExpiry(metadata, 60000);

      expect(metadata.expiry).toBe(60000);
    });

    it("should set namespace", () => {
      stageNamespace(metadata, "orders");

      expect(metadata.namespace).toBe("orders");
    });

    it("should set version", () => {
      stageVersion(metadata, 2);

      expect(metadata.version).toBe(2);
    });
  });
});
