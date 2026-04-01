import { isString } from "@lindorm/is";
import { IScanData, Scanner } from "@lindorm/scanner";
import type { Constructor } from "@lindorm/types";
import type { z } from "zod";
import { HermesViewEntity } from "../../entities/HermesViewEntity";
import { extractNameData, getHermesMetadata } from "#internal/metadata";
import type {
  HandlerKind,
  MetaHandler,
  MetaMethodModifier,
  MetaUpcaster,
  MetaValidation,
  StagedMetadata,
} from "#internal/metadata";
import type {
  HandlerConditions,
  HandlerRegistration,
  RegisteredAggregate,
  RegisteredDto,
  RegisteredSaga,
  RegisteredUpcaster,
  RegisteredView,
  ScannedModules,
  HermesScannerInput,
} from "./types";

const DEFAULT_NAMESPACE = "hermes";

// -- File scanning --

const createScanner = (): Scanner =>
  new Scanner({
    deniedFilenames: [/^index$/],
    deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
  });

const scanFile = (scanner: Scanner, data: IScanData): Constructor | null => {
  if (!data.isFile) return null;

  const module = scanner.require<Record<string, unknown>>(data.fullPath);
  if (!module) return null;

  for (const value of Object.values(module)) {
    if (typeof value === "function" && value.prototype) {
      return value as Constructor;
    }
  }

  return null;
};

const collectClassesFromScan = (
  scanner: Scanner,
  data: IScanData,
): Array<Constructor> => {
  const result: Array<Constructor> = [];

  if (data.isFile) {
    const ctor = scanFile(scanner, data);
    if (ctor) result.push(ctor);
  }

  if (data.isDirectory) {
    for (const child of data.children) {
      result.push(...collectClassesFromScan(scanner, child));
    }
  }

  return result;
};

const discoverClasses = (input: HermesScannerInput): Array<Constructor> => {
  const result: Array<Constructor> = [];
  const scanner = createScanner();

  for (const item of input) {
    if (isString(item)) {
      const data = scanner.scan(item);
      result.push(...collectClassesFromScan(scanner, data));
    } else if (typeof item === "function" && item.prototype) {
      result.push(item);
    }
  }

  return result;
};

// -- Metadata resolution --

const buildConditions = (
  methodName: string,
  modifiers: Array<MetaMethodModifier>,
): HandlerConditions => {
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
};

const findValidationSchema = (
  methodName: string,
  validations: Array<MetaValidation>,
): z.ZodType | null => {
  for (const v of validations) {
    if (v.methodName === methodName) return v.schema;
  }
  return null;
};

const buildHandlerRegistration = (
  handler: MetaHandler,
  modifiers: Array<MetaMethodModifier>,
  validations: Array<MetaValidation>,
): HandlerRegistration => ({
  kind: handler.kind,
  methodName: handler.methodName,
  trigger: handler.trigger,
  conditions: buildConditions(handler.methodName, modifiers),
  schema: findValidationSchema(handler.methodName, validations),
});

const filterHandlers = (
  handlers: Array<HandlerRegistration>,
  ...kinds: Array<HandlerKind>
): Array<HandlerRegistration> => handlers.filter((h) => kinds.includes(h.kind));

// -- Aggregate resolution --

const resolveAggregateName = (
  target: Constructor,
): { name: string; namespace: string } => {
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
};

// -- View entity validation --

const validateViewEntity = (
  entity: Constructor,
  viewName: string,
): Constructor<HermesViewEntity> => {
  if (!(entity.prototype instanceof HermesViewEntity)) {
    throw new Error(
      `View "${viewName}" entity class "${entity.name}" must extend HermesViewEntity`,
    );
  }
  return entity as Constructor<HermesViewEntity>;
};

// -- Upcaster resolution --

const buildRegisteredUpcasters = (
  upcasters: Array<MetaUpcaster>,
): Array<RegisteredUpcaster> =>
  upcasters.map((u) => {
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

// -- Main scanner function --

export const scanModules = (input: HermesScannerInput): ScannedModules => {
  const classes = discoverClasses(input);

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
      buildHandlerRegistration(h, meta.methodModifiers ?? [], meta.validations ?? []),
    );

    if (meta.aggregate) {
      aggregates.push({
        name: meta.aggregate.name,
        namespace: meta.namespace ?? DEFAULT_NAMESPACE,
        forgettable: !!meta.forgettable,
        target,
        commandHandlers: filterHandlers(handlers, "AggregateCommandHandler"),
        eventHandlers: filterHandlers(handlers, "AggregateEventHandler"),
        errorHandlers: filterHandlers(handlers, "AggregateErrorHandler"),
        upcasters: buildRegisteredUpcasters(meta.upcasters ?? []),
      });
      continue;
    }

    if (meta.saga) {
      const resolvedAggregates = meta.saga.aggregates.map((agg) =>
        resolveAggregateName(agg),
      );

      sagas.push({
        name: meta.saga.name,
        namespace: meta.namespace ?? DEFAULT_NAMESPACE,
        aggregates: resolvedAggregates,
        target,
        eventHandlers: filterHandlers(handlers, "SagaEventHandler"),
        idHandlers: filterHandlers(handlers, "SagaIdHandler"),
        timeoutHandlers: filterHandlers(handlers, "SagaTimeoutHandler"),
        errorHandlers: filterHandlers(handlers, "SagaErrorHandler"),
      });
      continue;
    }

    if (meta.view) {
      const resolvedAggregates = meta.view.aggregates.map((agg) =>
        resolveAggregateName(agg),
      );

      const validatedEntity = validateViewEntity(meta.view.entity, meta.view.name);

      views.push({
        name: meta.view.name,
        namespace: meta.namespace ?? DEFAULT_NAMESPACE,
        aggregates: resolvedAggregates,
        entity: validatedEntity,
        driverType: meta.view.driverType,
        target,
        eventHandlers: filterHandlers(handlers, "ViewEventHandler"),
        idHandlers: filterHandlers(handlers, "ViewIdHandler"),
        queryHandlers: filterHandlers(handlers, "ViewQueryHandler"),
        errorHandlers: filterHandlers(handlers, "ViewErrorHandler"),
      });
      continue;
    }
  }

  return { commands, events, queries, timeouts, aggregates, sagas, views };
};
