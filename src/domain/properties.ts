import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

export type PropertyType = "string" | "number";
export type PropertyValue = string | number;
export type PropertyValues = Readonly<Record<string, PropertyValue>>;
export type PropertyInput = Readonly<Record<string, PropertyValue | null>>;
export type TagProperty = Readonly<{ tagKey: string; key: string; type: PropertyType }>;
export type TagNotFoundError = Readonly<{ type: "tag-not-found" }>;
export type PropertyDefinitionError =
  | TagNotFoundError
  | Readonly<{ type: "property-type-conflict"; tagKey: string; propertyKey: string }>;
export type PropertyValueError =
  | TagNotFoundError
  | Readonly<{ type: "property-not-defined"; tagKey: string; propertyKey: string }>
  | Readonly<{
      type: "invalid-property-value";
      tagKey: string;
      propertyKey: string;
      expected: PropertyType;
    }>;
export type EnsureTagPropertyResult = Result<TagProperty, PropertyDefinitionError>;

export function applyValues(
  tagKey: string,
  definitions: ReadonlyMap<string, TagProperty>,
  values: PropertyInput,
  current: PropertyValues,
): Result<PropertyValues, PropertyValueError> {
  const entries = Object.entries(values);
  for (const [key, value] of entries) {
    const definition = definitions.get(key);
    if (definition === undefined) {
      return err({ type: "property-not-defined", tagKey, propertyKey: key });
    }
    if (
      value !== null &&
      (typeof value !== definition.type || (typeof value === "number" && !Number.isFinite(value)))
    ) {
      return err({
        type: "invalid-property-value",
        tagKey,
        propertyKey: key,
        expected: definition.type,
      });
    }
  }
  const properties = new Map(Object.entries(current));
  for (const [key, value] of entries) {
    if (value === null) properties.delete(key);
    else properties.set(key, value);
  }
  return ok(Object.freeze(Object.fromEntries(properties)));
}
