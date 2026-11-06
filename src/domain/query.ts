import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import type { QueryItem } from "./objects";
import type { PropertyValue, TagProperty } from "./properties";
import type { Tags } from "./tags";

export type { QueryItem } from "./objects";
export type QueryFilter =
  | Readonly<{ tagKey: string }>
  | Readonly<{
      tagKey: string;
      propertyKey: string;
      op: "eq" | "gt" | "gte" | "lt" | "lte";
      value: PropertyValue | null;
    }>
  | Readonly<{ and: readonly QueryFilter[] }>
  | Readonly<{ or: readonly QueryFilter[] }>
  | Readonly<{ not: QueryFilter }>;
export type QuerySort = Readonly<{
  tagKey: string;
  propertyKey: string;
  direction: "asc" | "desc";
}>;
export type QueryOptions = Readonly<{
  filter?: QueryFilter;
  sort?: readonly QuerySort[];
  offset?: number;
  limit?: number;
}>;
export type QueryPage = Readonly<{ items: readonly QueryItem[]; nextOffset: number | null }>;
export type QueryError = Readonly<{ type: "invalid-query"; message: string }>;
export type QueryResult = Result<QueryPage, QueryError>;

type Predicate = (item: QueryItem) => boolean;

function invalid(path: string, reason: string, hint: string): Result<never, QueryError> {
  return err({ type: "invalid-query", message: `${path}: ${reason} ${hint}` });
}

function quote(value: string): string {
  return JSON.stringify(value.length > 80 ? `${value.slice(0, 80)}…` : value);
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return `string ${quote(value)}`;
  if (typeof value === "number") return `number ${value}`;
  return typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function hasKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}

function describeKeys(value: Record<string, unknown>): string {
  const keys = Object.keys(value);
  const sample = keys.slice(0, 4).map(quote).join(", ") || "(none)";
  return keys.length > 4 ? `${sample}, … (${keys.length} keys)` : sample;
}

function tagError(tags: Tags, tagKey: unknown, path: string): Result<string, QueryError> {
  if (typeof tagKey !== "string")
    return invalid(
      path,
      `Expected a registered Tag key string; received ${describe(tagKey)}.`,
      "Supply tagKey from ensureTag.",
    );
  if (!tags.has(tagKey))
    return invalid(
      path,
      `Tag ${quote(tagKey)} is not registered in this Core.`,
      "Use a registered tagKey or register it with ensureTag.",
    );
  return ok(tagKey);
}

function propertyDefinition(
  tags: Tags,
  tagKey: string,
  propertyKey: unknown,
  path: string,
): Result<TagProperty, QueryError> {
  if (typeof propertyKey !== "string")
    return invalid(
      path,
      `Expected a Property key string; received ${describe(propertyKey)}.`,
      "Supply a registered propertyKey for this Tag.",
    );
  const definition = tags.getProperty(tagKey, propertyKey);
  if (definition === undefined)
    return invalid(
      path,
      `Property ${quote(propertyKey)} is not registered on Tag ${quote(tagKey)}.`,
      "Use a registered propertyKey for this Tag or register it with ensureTagProperty.",
    );
  return ok(definition);
}

function valueOf(
  item: QueryItem,
  spec: Readonly<{ tagKey: string; propertyKey: string }>,
): PropertyValue | undefined {
  const values = item.attachments.find(({ tag }) => tag.key === spec.tagKey)?.properties;
  return values !== undefined && Object.hasOwn(values, spec.propertyKey)
    ? values[spec.propertyKey]
    : undefined;
}

function compare(left: PropertyValue | undefined, right: PropertyValue | undefined): number {
  if (left === right) return 0;
  if (left === undefined) return -1;
  if (right === undefined) return 1;
  if (typeof left === "number" && typeof right === "number") return left < right ? -1 : 1;
  if (typeof left === "string" && typeof right === "string") return left < right ? -1 : 1;
  return typeof left === "number" ? -1 : 1;
}

function compileFilter(
  input: unknown,
  tags: Tags,
  path = "filter",
  ancestors = new Set<object>(),
): Result<Predicate, QueryError> {
  if (!isRecord(input))
    return invalid(
      path,
      `Expected a condition object; received ${describe(input)}.`,
      "Use {tagKey}, {tagKey, propertyKey, op, value}, {and: [...]}, {or: [...]}, or {not: condition}; omit filter for all Objects.",
    );
  if (ancestors.has(input))
    return invalid(
      path,
      "A cyclic condition is not JSON data.",
      "Remove the circular reference and supply an acyclic condition.",
    );
  ancestors.add(input);
  const result = compileNode(input, tags, path, ancestors);
  ancestors.delete(input);
  return result;
}

function compileNode(
  input: Record<string, unknown>,
  tags: Tags,
  path: string,
  ancestors: Set<object>,
): Result<Predicate, QueryError> {
  for (const key of ["and", "or"] as const) {
    if (!Object.hasOwn(input, key)) continue;
    if (!hasKeys(input, [key]))
      return invalid(
        path,
        `A ${key} condition must contain only ${key}; received keys ${describeKeys(input)}.`,
        "Put each condition inside the logical array instead of mixing node shapes.",
      );
    const children = input[key];
    if (!Array.isArray(children) || children.length === 0)
      return invalid(
        `${path}.${key}`,
        `Expected at least one condition in an array; received ${Array.isArray(children) ? "an empty array" : describe(children)}.`,
        "Supply one or more conditions, or omit filter for all Objects.",
      );
    const predicates: Predicate[] = [];
    for (let index = 0; index < children.length; index++) {
      const child = compileFilter(children[index], tags, `${path}.${key}[${index}]`, ancestors);
      if (child.isErr()) return err(child.error);
      predicates.push(child.value);
    }
    return ok(
      key === "and"
        ? (item) => predicates.every((predicate) => predicate(item))
        : (item) => predicates.some((predicate) => predicate(item)),
    );
  }
  if (Object.hasOwn(input, "not")) {
    if (!hasKeys(input, ["not"]))
      return invalid(
        path,
        "A not condition must contain only not.",
        "Use {not: condition} without sibling fields.",
      );
    return compileFilter(input.not, tags, `${path}.not`, ancestors).map(
      (predicate) => (item) => !predicate(item),
    );
  }
  if (!hasKeys(input, ["tagKey"]) && !hasKeys(input, ["tagKey", "propertyKey", "op", "value"]))
    return invalid(
      path,
      `Expected a condition; received keys ${describeKeys(input)}.`,
      "Use {tagKey}, {tagKey, propertyKey, op, value}, {and: [...]}, {or: [...]}, or {not: condition}; omit filter for all Objects.",
    );
  const tag = tagError(tags, input.tagKey, `${path}.tagKey`);
  if (tag.isErr()) return err(tag.error);
  const tagKey = tag.value;
  if (hasKeys(input, ["tagKey"]))
    return ok((item) => item.attachments.some(({ tag }) => tag.key === tagKey));
  const definition = propertyDefinition(tags, tagKey, input.propertyKey, `${path}.propertyKey`);
  if (definition.isErr()) return err(definition.error);
  const { key: propertyKey, type } = definition.value;
  const { op, value } = input;
  if (op !== "eq" && op !== "gt" && op !== "gte" && op !== "lt" && op !== "lte")
    return invalid(
      `${path}.op`,
      `Expected eq, gt, gte, lt, or lte; received ${describe(op)}.`,
      "Use one supported comparison operator.",
    );
  if (value === null && op !== "eq")
    return invalid(
      `${path}.value`,
      `null is not a value for ${op}.`,
      'Use op: "eq", value: null to find unset values; otherwise supply a typed value.',
    );
  if (
    value !== null &&
    (typeof value !== type || (typeof value === "number" && !Number.isFinite(value)))
  )
    return invalid(
      `${path}.value`,
      `Property ${quote(propertyKey)} on Tag ${quote(tagKey)} expects ${type}${type === "number" ? " (finite)" : ""}; received ${describe(value)}.`,
      `Supply a ${type} value; no type conversion is performed.`,
    );
  // The definition check above narrows the runtime input to the stored scalar types.
  const expected = value as PropertyValue | null;
  return ok((item) => {
    if (!item.attachments.some(({ tag }) => tag.key === tagKey)) return false;
    const actual = valueOf(item, { tagKey, propertyKey });
    if (expected === null) return actual === undefined;
    if (op === "eq") return actual === expected;
    if (actual === undefined) return false;
    const order = compare(actual, expected);
    switch (op) {
      case "gt":
        return order > 0;
      case "gte":
        return order >= 0;
      case "lt":
        return order < 0;
      case "lte":
        return order <= 0;
    }
  });
}

function validateSort(input: unknown, tags: Tags): Result<readonly QuerySort[], QueryError> {
  if (!Array.isArray(input))
    return invalid(
      "sort",
      `Expected an array; received ${describe(input)}.`,
      "Use [{tagKey, propertyKey, direction: 'asc' | 'desc'}] or omit sort for ID order.",
    );
  const sorts: QuerySort[] = [];
  for (let index = 0; index < input.length; index++) {
    const spec: unknown = input[index];
    const path = `sort[${index}]`;
    if (!isRecord(spec) || !hasKeys(spec, ["tagKey", "propertyKey", "direction"]))
      return invalid(
        path,
        `Expected {tagKey, propertyKey, direction}; received ${describe(spec)} with missing or extra fields.`,
        "Supply exactly those three fields.",
      );
    const tag = tagError(tags, spec.tagKey, `${path}.tagKey`);
    if (tag.isErr()) return err(tag.error);
    const definition = propertyDefinition(tags, tag.value, spec.propertyKey, `${path}.propertyKey`);
    if (definition.isErr()) return err(definition.error);
    const { direction } = spec;
    if (direction !== "asc" && direction !== "desc")
      return invalid(
        `${path}.direction`,
        `Expected asc or desc; received ${describe(direction)}.`,
        'Use direction: "asc" or direction: "desc".',
      );
    sorts.push({ tagKey: tag.value, propertyKey: definition.value.key, direction });
  }
  return ok(sorts);
}

export function query(items: readonly QueryItem[], options: QueryOptions, tags: Tags): QueryResult {
  if (!isRecord(options))
    return invalid(
      "query",
      `Expected an options object; received ${describe(options)}.`,
      "Supply {filter?, sort?, offset?, limit?} or omit options.",
    );
  const unknownKey = Object.keys(options).find(
    (key) => !["filter", "sort", "offset", "limit"].includes(key),
  );
  if (unknownKey !== undefined)
    return invalid(
      "query",
      `Unknown option ${quote(unknownKey)}.`,
      "Use only filter, sort, offset, and limit.",
    );
  const { filter, sort = [], offset = 0, limit = 20 } = options;
  if (!Number.isFinite(offset) || !Number.isInteger(offset) || offset < 0)
    return invalid(
      "offset",
      `Expected a finite integer >= 0; received ${describe(offset)}.`,
      "Use 0 for the first page or the previous nextOffset.",
    );
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 1)
    return invalid(
      "limit",
      `Expected a finite integer >= 1; received ${describe(limit)}.`,
      "Supply a positive integer or omit limit for 20 results.",
    );
  const predicate =
    filter === undefined ? ok<Predicate, QueryError>(() => true) : compileFilter(filter, tags);
  if (predicate.isErr()) return err(predicate.error);
  const sorts = validateSort(sort, tags);
  if (sorts.isErr()) return err(sorts.error);
  const selected = items.filter(predicate.value);
  selected.sort((left, right) => {
    for (const spec of sorts.value) {
      const order = compare(valueOf(left, spec), valueOf(right, spec));
      if (order !== 0) return spec.direction === "asc" ? order : -order;
    }
    return compare(left.object.id, right.object.id);
  });
  const page = Object.freeze(selected.slice(offset, offset + limit));
  const nextOffset = offset + page.length < selected.length ? offset + page.length : null;
  return ok(Object.freeze({ items: page, nextOffset }));
}
