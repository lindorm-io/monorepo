import type {
  HandlerKind,
  MetaHandler,
  MetaMethodModifier,
  MetaUpcaster,
  MetaValidation,
  StagedMetadata,
} from "../metadata";
import { extractNameData, getHermesMetadata } from "../metadata";
import { isString } from "@lindorm/is";
import { IScanData, Scanner } from "@lindorm/scanner";
import type { Constructor } from "@lindorm/types";
import type { z } from "zod";
import { HermesViewEntity } from "../../entities/HermesViewEntity";
import type {
  HandlerConditions,
  HandlerRegistration,
  HermesScannerInput,
  RegisteredAggregate,
  RegisteredDto,
  RegisteredSaga,
  RegisteredUpcaster,
  RegisteredView,
  ScannedModules,
} from "./types";

const DEFAULT_NAMESPACE = "hermes";

export class HermesScanner {
  public static scan(input: HermesScannerInput): ScannedModules {
    const classes = HermesScanner.discoverClasses(input);

    const commands: Array<RegisteredDto> = [];
    const events: Array<RegisteredDto> = [];
    const queries: Array<RegisteredDto> = [];
    const timeouts: Array<RegisteredDto> = [];
    const aggregates: Array<RegisteredAggregate> = [];
    const sagas: Array<RegisteredSaga> = [];
    const views: Array<RegisteredView> = [];

    for (const target of classes) {
      const meta: StagedMetadata = getHermesMetadata(target);

      // -- DTO classes --

      if (meta.dto) {
        const dto: RegisteredDto = {
          kind: meta.dto.kind,
          name: meta.dto.name,
          version: meta.dto.version,
          target,
        };

        switch (meta.dto.kind) {
          case "command":
            commands.push(dto);
            break;
          case "event":
            events.push(dto);
            break;
          case "query":
            queries.push(dto);
            break;
          case "timeout":
            timeouts.push(dto);
            break;
        }

        continue;
      }

      // -- Domain classes (have handlers) --

      const handlers = (meta.handlers ?? []).map((h) =>
        HermesScanner.buildHandlerRegistration(
          h,
          meta.methodModifiers ?? [],
          meta.validations ?? [],
        ),
      );

      if (meta.aggregate) {
        aggregates.push({
          name: meta.aggregate.name,
          namespace: meta.namespace ?? DEFAULT_NAMESPACE,
          forgettable: !!meta.forgettable,
          target,
          commandHandlers: HermesScanner.filterHandlers(
            handlers,
            "AggregateCommandHandler",
          ),
          eventHandlers: HermesScanner.filterHandlers(handlers, "AggregateEventHandler"),
          errorHandlers: HermesScanner.filterHandlers(handlers, "AggregateErrorHandler"),
          upcasters: HermesScanner.buildRegisteredUpcasters(meta.upcasters ?? []),
        });
        continue;
      }

      if (meta.saga) {
        const resolvedAggregates = meta.saga.aggregates.map((agg) =>
          HermesScanner.resolveAggregateName(agg),
        );

        sagas.push({
          name: meta.saga.name,
          namespace: meta.namespace ?? DEFAULT_NAMESPACE,
          aggregates: resolvedAggregates,
          target,
          eventHandlers: HermesScanner.filterHandlers(handlers, "SagaEventHandler"),
          idHandlers: HermesScanner.filterHandlers(handlers, "SagaIdHandler"),
          timeoutHandlers: HermesScanner.filterHandlers(handlers, "SagaTimeoutHandler"),
          errorHandlers: HermesScanner.filterHandlers(handlers, "SagaErrorHandler"),
        });
        continue;
      }

      if (meta.view) {
        const resolvedAggregates = meta.view.aggregates.map((agg) =>
          HermesScanner.resolveAggregateName(agg),
        );

        const validatedEntity = HermesScanner.validateViewEntity(
          meta.view.entity,
          meta.view.name,
        );

        views.push({
          name: meta.view.name,
          namespace: meta.namespace ?? DEFAULT_NAMESPACE,
          aggregates: resolvedAggregates,
          entity: validatedEntity,
          driverType: meta.view.driverType,
          target,
          eventHandlers: HermesScanner.filterHandlers(handlers, "ViewEventHandler"),
          idHandlers: HermesScanner.filterHandlers(handlers, "ViewIdHandler"),
          queryHandlers: HermesScanner.filterHandlers(handlers, "ViewQueryHandler"),
          errorHandlers: HermesScanner.filterHandlers(handlers, "ViewErrorHandler"),
        });
        continue;
      }
    }

    return { commands, events, queries, timeouts, aggregates, sagas, views };
  }

  // private

  private static createScanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }

  private static scanFile(scanner: Scanner, data: IScanData): Constructor | null {
    if (!data.isFile) return null;

    const module = scanner.require<Record<string, unknown>>(data.fullPath);
    if (!module) return null;

    for (const value of Object.values(module)) {
      if (typeof value === "function" && value.prototype) {
        return value as Constructor;
      }
    }

    return null;
  }

  private static collectClassesFromScan(
    scanner: Scanner,
    data: IScanData,
  ): Array<Constructor> {
    const result: Array<Constructor> = [];

    if (data.isFile) {
      const ctor = HermesScanner.scanFile(scanner, data);
      if (ctor) result.push(ctor);
    }

    if (data.isDirectory) {
      for (const child of data.children) {
        result.push(...HermesScanner.collectClassesFromScan(scanner, child));
      }
    }

    return result;
  }

  private static discoverClasses(input: HermesScannerInput): Array<Constructor> {
    const result: Array<Constructor> = [];
    const scanner = HermesScanner.createScanner();

    for (const item of input) {
      if (isString(item)) {
        const data = scanner.scan(item);
        result.push(...HermesScanner.collectClassesFromScan(scanner, data));
      } else if (typeof item === "function" && item.prototype) {
        result.push(item);
      }
    }

    return result;
  }

  private static buildConditions(
    methodName: string,
    modifiers: Array<MetaMethodModifier>,
  ): HandlerConditions {
    const conditions: HandlerConditions = {};

    for (const mod of modifiers) {
      if (mod.methodName !== methodName) continue;

      if (mod.modifier === "requireCreated") {
        conditions.requireCreated = true;
      }
      if (mod.modifier === "requireNotCreated") {
        conditions.requireNotCreated = true;
      }
    }

    return conditions;
  }

  private static findValidationSchema(
    methodName: string,
    validations: Array<MetaValidation>,
  ): z.ZodType | null {
    for (const v of validations) {
      if (v.methodName === methodName) return v.schema;
    }
    return null;
  }

  private static buildHandlerRegistration(
    handler: MetaHandler,
    modifiers: Array<MetaMethodModifier>,
    validations: Array<MetaValidation>,
  ): HandlerRegistration {
    return {
      kind: handler.kind,
      methodName: handler.methodName,
      trigger: handler.trigger,
      conditions: HermesScanner.buildConditions(handler.methodName, modifiers),
      schema: HermesScanner.findValidationSchema(handler.methodName, validations),
    };
  }

  private static filterHandlers(
    handlers: Array<HandlerRegistration>,
    ...kinds: Array<HandlerKind>
  ): Array<HandlerRegistration> {
    return handlers.filter((h) => kinds.includes(h.kind));
  }

  private static resolveAggregateName(target: Constructor): {
    name: string;
    namespace: string;
  } {
    const meta = getHermesMetadata(target);

    if (!meta.aggregate) {
      throw new Error(
        `Aggregate constructor ${target.name} referenced by saga/view has no @Aggregate() metadata`,
      );
    }

    return {
      name: meta.aggregate.name,
      namespace: meta.namespace ?? DEFAULT_NAMESPACE,
    };
  }

  private static validateViewEntity(
    entity: Constructor,
    viewName: string,
  ): Constructor<HermesViewEntity> {
    if (!(entity.prototype instanceof HermesViewEntity)) {
      throw new Error(
        `View "${viewName}" entity class "${entity.name}" must extend HermesViewEntity`,
      );
    }
    return entity as Constructor<HermesViewEntity>;
  }

  private static buildRegisteredUpcasters(
    upcasters: Array<MetaUpcaster>,
  ): Array<RegisteredUpcaster> {
    return upcasters.map((u) => {
      const fromData = extractNameData(u.from.name);
      const toData = extractNameData(u.to.name);

      return {
        fromName: fromData.name,
        fromVersion: fromData.version,
        toVersion: toData.version,
        method: u.method,
        from: u.from,
        to: u.to,
      };
    });
  }
}
