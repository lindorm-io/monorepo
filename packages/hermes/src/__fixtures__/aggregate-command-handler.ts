import { z } from "zod";
import { HermesAggregateCommandHandler } from "../handlers";
import { AggregateCommandHandlerOptions } from "../types";
import { TEST_AGGREGATE_OPTIONS } from "./aggregate";
import {
  TEST_HERMES_COMMAND,
  TEST_HERMES_COMMAND_ADD_FIELD,
  TEST_HERMES_COMMAND_CREATE,
  TEST_HERMES_COMMAND_DESTROY,
  TEST_HERMES_COMMAND_DESTROY_NEXT,
  TEST_HERMES_COMMAND_DISPATCH,
  TEST_HERMES_COMMAND_ENCRYPT,
  TEST_HERMES_COMMAND_MERGE_STATE,
  TEST_HERMES_COMMAND_REMOVE_FIELD_WHERE_EQUAL,
  TEST_HERMES_COMMAND_REMOVE_FIELD_WHERE_MATCH,
  TEST_HERMES_COMMAND_SET_STATE,
  TEST_HERMES_COMMAND_THROWS,
  TEST_HERMES_COMMAND_TIMEOUT,
} from "./hermes-command";

export const TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS: AggregateCommandHandlerOptions = {
  aggregate: {
    name: TEST_AGGREGATE_OPTIONS.name,
    context: TEST_AGGREGATE_OPTIONS.context,
  },
  commandName: TEST_HERMES_COMMAND.name,
  conditions: { created: true },
  schema: z.object({
    commandData: z.boolean(),
  }),
  handler: jest.fn().mockImplementation(async () => {}),
};

export const TEST_AGGREGATE_COMMAND_HANDLER = new HermesAggregateCommandHandler(
  TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
);

export const TEST_AGGREGATE_COMMAND_HANDLER_CREATE = new HermesAggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_HERMES_COMMAND_CREATE.name,
  conditions: { created: false },
  handler: jest.fn().mockImplementation(async (ctx) => {
    class HermesEventCreate {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new HermesEventCreate(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_ADD_FIELD = new HermesAggregateCommandHandler(
  {
    ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
    commandName: TEST_HERMES_COMMAND_ADD_FIELD.name,
    handler: jest.fn().mockImplementation(async (ctx) => {
      class HermesEventAddField {
        constructor(public readonly dataFromCommand: any) {}
      }
      await ctx.apply(new HermesEventAddField(ctx.command));
    }),
  },
);

export const TEST_AGGREGATE_COMMAND_HANDLER_DESTROY = new HermesAggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_HERMES_COMMAND_DESTROY.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class HermesEventDestroy {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new HermesEventDestroy(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT =
  new HermesAggregateCommandHandler({
    ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
    commandName: TEST_HERMES_COMMAND_DESTROY_NEXT.name,
    handler: jest.fn().mockImplementation(async (ctx) => {
      class HermesEventDestroyNext {
        constructor(public readonly dataFromCommand: any) {}
      }
      await ctx.apply(new HermesEventDestroyNext(ctx.command));
    }),
  });

export const TEST_AGGREGATE_COMMAND_HANDLER_DISPATCH = new HermesAggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_HERMES_COMMAND_DISPATCH.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class HermesEventDispatch {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new HermesEventDispatch(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_ENCRYPT = new HermesAggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_HERMES_COMMAND_ENCRYPT.name,
  conditions: {},
  encryption: true,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class HermesEventEncrypt {
      constructor(public readonly encryptedData: any) {}
    }
    await ctx.apply(new HermesEventEncrypt(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE =
  new HermesAggregateCommandHandler({
    ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
    commandName: TEST_HERMES_COMMAND_MERGE_STATE.name,
    handler: jest.fn().mockImplementation(async (ctx) => {
      class HermesEventMergeState {
        constructor(public readonly dataFromCommand: any) {}
      }
      await ctx.apply(new HermesEventMergeState(ctx.command));
    }),
  });

export const TEST_AGGREGATE_COMMAND_HANDLER_REMOVE_FIELD_WHERE_EQUAL =
  new HermesAggregateCommandHandler({
    ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
    commandName: TEST_HERMES_COMMAND_REMOVE_FIELD_WHERE_EQUAL.name,
    handler: jest.fn().mockImplementation(async (ctx) => {
      class HermesEventRemoveFieldWhereEqual {
        constructor(public readonly dataFromCommand: any) {}
      }
      await ctx.apply(new HermesEventRemoveFieldWhereEqual(ctx.command));
    }),
  });

export const TEST_AGGREGATE_COMMAND_HANDLER_REMOVE_FIELD_WHERE_MATCH =
  new HermesAggregateCommandHandler({
    ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
    commandName: TEST_HERMES_COMMAND_REMOVE_FIELD_WHERE_MATCH.name,
    handler: jest.fn().mockImplementation(async (ctx) => {
      class HermesEventRemoveFieldWhereMatch {
        constructor(public readonly dataFromCommand: any) {}
      }
      await ctx.apply(new HermesEventRemoveFieldWhereMatch(ctx.command));
    }),
  });

export const TEST_AGGREGATE_COMMAND_HANDLER_SET_STATE = new HermesAggregateCommandHandler(
  {
    ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
    commandName: TEST_HERMES_COMMAND_SET_STATE.name,
    handler: jest.fn().mockImplementation(async (ctx) => {
      class HermesEventSetState {
        constructor(public readonly dataFromCommand: any) {}
      }
      await ctx.apply(new HermesEventSetState(ctx.command));
    }),
  },
);

export const TEST_AGGREGATE_COMMAND_HANDLER_THROWS = new HermesAggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_HERMES_COMMAND_THROWS.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class HermesEventThrows {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new HermesEventThrows(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_TIMEOUT = new HermesAggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_HERMES_COMMAND_TIMEOUT.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class HermesEventTimeout {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new HermesEventTimeout(ctx.command));
  }),
});
