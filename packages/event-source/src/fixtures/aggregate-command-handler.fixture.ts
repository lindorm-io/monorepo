import Joi from "joi";
import { AggregateCommandHandlerImplementation } from "../handler";
import { AggregateCommandHandlerOptions } from "../types";
import { TEST_AGGREGATE_OPTIONS } from "./aggregate.fixture";
import {
  TEST_COMMAND,
  TEST_COMMAND_ADD_FIELD,
  TEST_COMMAND_CREATE,
  TEST_COMMAND_DESTROY,
  TEST_COMMAND_DESTROY_NEXT,
  TEST_COMMAND_DISPATCH,
  TEST_COMMAND_MERGE_STATE,
  TEST_COMMAND_REMOVE_FIELD_WHERE_EQUAL,
  TEST_COMMAND_REMOVE_FIELD_WHERE_MATCH,
  TEST_COMMAND_SET_STATE,
  TEST_COMMAND_THROWS,
  TEST_COMMAND_TIMEOUT,
} from "./command.fixture";

export const TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS: AggregateCommandHandlerOptions = {
  aggregate: {
    name: TEST_AGGREGATE_OPTIONS.name,
    context: TEST_AGGREGATE_OPTIONS.context,
  },
  commandName: TEST_COMMAND.name,

  conditions: { created: true },
  schema: Joi.object()
    .keys({
      commandData: Joi.boolean().required(),
    })
    .required(),

  handler: jest.fn().mockImplementation(async () => {}),
};

export const TEST_AGGREGATE_COMMAND_HANDLER = new AggregateCommandHandlerImplementation(
  TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
);

export const TEST_AGGREGATE_COMMAND_HANDLER_CREATE = new AggregateCommandHandlerImplementation({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_CREATE.name,
  conditions: { created: false },
  handler: jest.fn().mockImplementation(async (ctx) => {
    class DomainEventCreate {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new DomainEventCreate(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_ADD_FIELD = new AggregateCommandHandlerImplementation({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_ADD_FIELD.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class DomainEventAddField {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new DomainEventAddField(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_DESTROY = new AggregateCommandHandlerImplementation({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_DESTROY.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class DomainEventDestroy {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new DomainEventDestroy(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT =
  new AggregateCommandHandlerImplementation({
    ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
    commandName: TEST_COMMAND_DESTROY_NEXT.name,
    handler: jest.fn().mockImplementation(async (ctx) => {
      class DomainEventDestroyNext {
        constructor(public readonly dataFromCommand: any) {}
      }
      await ctx.apply(new DomainEventDestroyNext(ctx.command));
    }),
  });

export const TEST_AGGREGATE_COMMAND_HANDLER_DISPATCH = new AggregateCommandHandlerImplementation({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_DISPATCH.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class DomainEventDispatch {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new DomainEventDispatch(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE = new AggregateCommandHandlerImplementation(
  {
    ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
    commandName: TEST_COMMAND_MERGE_STATE.name,
    handler: jest.fn().mockImplementation(async (ctx) => {
      class DomainEventMergeState {
        constructor(public readonly dataFromCommand: any) {}
      }
      await ctx.apply(new DomainEventMergeState(ctx.command));
    }),
  },
);

export const TEST_AGGREGATE_COMMAND_HANDLER_REMOVE_FIELD_WHERE_EQUAL =
  new AggregateCommandHandlerImplementation({
    ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
    commandName: TEST_COMMAND_REMOVE_FIELD_WHERE_EQUAL.name,
    handler: jest.fn().mockImplementation(async (ctx) => {
      class DomainEventRemoveFieldWhereEqual {
        constructor(public readonly dataFromCommand: any) {}
      }
      await ctx.apply(new DomainEventRemoveFieldWhereEqual(ctx.command));
    }),
  });

export const TEST_AGGREGATE_COMMAND_HANDLER_REMOVE_FIELD_WHERE_MATCH =
  new AggregateCommandHandlerImplementation({
    ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
    commandName: TEST_COMMAND_REMOVE_FIELD_WHERE_MATCH.name,
    handler: jest.fn().mockImplementation(async (ctx) => {
      class DomainEventRemoveFieldWhereMatch {
        constructor(public readonly dataFromCommand: any) {}
      }
      await ctx.apply(new DomainEventRemoveFieldWhereMatch(ctx.command));
    }),
  });

export const TEST_AGGREGATE_COMMAND_HANDLER_SET_STATE = new AggregateCommandHandlerImplementation({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_SET_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class DomainEventSetState {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new DomainEventSetState(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_THROWS = new AggregateCommandHandlerImplementation({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_THROWS.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class DomainEventThrows {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new DomainEventThrows(ctx.command));
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_TIMEOUT = new AggregateCommandHandlerImplementation({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_TIMEOUT.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    class DomainEventTimeout {
      constructor(public readonly dataFromCommand: any) {}
    }
    await ctx.apply(new DomainEventTimeout(ctx.command));
  }),
});
