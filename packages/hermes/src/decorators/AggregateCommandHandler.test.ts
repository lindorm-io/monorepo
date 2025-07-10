import { Dict } from "@lindorm/types";
import z from "zod";
import { AggregateCommandCtx } from "../types/handlers/aggregate-command-handler";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { AggregateCommandHandler } from "./AggregateCommandHandler";
import { Command } from "./Command";

describe("AggregateCommandHandler Decorator", () => {
  test("should add metadata", () => {
    @Command()
    class TestCommand {}

    @Aggregate()
    class TestAggregateCommandHandlerAggregate {
      @AggregateCommandHandler(TestCommand)
      public async onTestAggregateDomainCommand(
        ctx: AggregateCommandCtx<TestCommand, Dict>,
      ) {}
    }

    expect(
      globalHermesMetadata.getAggregate(TestAggregateCommandHandlerAggregate),
    ).toMatchSnapshot();
  });

  test("should add metadata with custom options", () => {
    @Command()
    class TestCommand {}

    @Aggregate()
    class TestAggregateCommandHandlerAggregate {
      @AggregateCommandHandler(TestCommand, {
        conditions: { created: true },
        encryption: true,
        schema: z.object({}),
      })
      public async onTestAggregateDomainCommand(
        ctx: AggregateCommandCtx<TestCommand, Dict>,
      ) {}
    }

    expect(
      globalHermesMetadata.getAggregate(TestAggregateCommandHandlerAggregate),
    ).toMatchSnapshot();
  });
});
