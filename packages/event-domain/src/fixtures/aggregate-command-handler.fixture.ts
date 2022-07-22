import Joi from "joi";
import { AggregateCommandHandler } from "../handler";
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
import {
  TEST_DOMAIN_EVENT_ADD_FIELD,
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_DESTROY_NEXT,
  TEST_DOMAIN_EVENT_DISPATCH,
  TEST_DOMAIN_EVENT_MERGE_STATE,
  TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_EQUAL,
  TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH,
  TEST_DOMAIN_EVENT_SET_STATE,
  TEST_DOMAIN_EVENT_THROWS,
  TEST_DOMAIN_EVENT_TIMEOUT,
} from "./domain-event.fixture";

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

export const TEST_AGGREGATE_COMMAND_HANDLER = new AggregateCommandHandler(
  TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
);

export const TEST_AGGREGATE_COMMAND_HANDLER_CREATE = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_CREATE.name,
  conditions: { created: false },
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_CREATE.name, ctx.command.data);
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_ADD_FIELD = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_ADD_FIELD.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_ADD_FIELD.name, ctx.command.data);
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_DESTROY = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_DESTROY.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_DESTROY.name, ctx.command.data);
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_DESTROY_NEXT.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_DESTROY_NEXT.name, ctx.command.data);
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_DISPATCH = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_DISPATCH.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_DISPATCH.name, ctx.command.data);
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_MERGE_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_MERGE_STATE.name, ctx.command.data);
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_REMOVE_FIELD_WHERE_EQUAL = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_REMOVE_FIELD_WHERE_EQUAL.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_EQUAL.name, ctx.command.data);
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_REMOVE_FIELD_WHERE_MATCH = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_REMOVE_FIELD_WHERE_MATCH.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_REMOVE_FIELD_WHERE_MATCH.name, ctx.command.data);
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_SET_STATE = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_SET_STATE.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_SET_STATE.name, ctx.command.data);
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_THROWS = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_THROWS.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_THROWS.name, ctx.command.data);
  }),
});

export const TEST_AGGREGATE_COMMAND_HANDLER_TIMEOUT = new AggregateCommandHandler({
  ...TEST_AGGREGATE_COMMAND_HANDLER_OPTIONS,
  commandName: TEST_COMMAND_TIMEOUT.name,
  handler: jest.fn().mockImplementation(async (ctx) => {
    await ctx.apply(TEST_DOMAIN_EVENT_TIMEOUT.name, ctx.command.data);
  }),
});
