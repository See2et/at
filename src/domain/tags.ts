import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { validateValues } from "./properties";
import type {
  EnsureTagPropertyResult,
  PropertyType,
  PropertyValues,
  PropertyValueError,
  TagProperty,
} from "./properties";

export type Tag = Readonly<{ key: string; name: string }>;

export type EnsureTagResult = Result<Tag, "tag-name-conflict">;

export class Tags {
  readonly #tags = new Map<string, Tag>();
  readonly #properties = new Map<string, Map<string, TagProperty>>();

  ensureTag(key: string, name: string): EnsureTagResult {
    const existing = this.#tags.get(key);
    if (existing !== undefined) {
      if (existing.name !== name) {
        return err("tag-name-conflict");
      }
      return ok(existing);
    }

    const tag: Tag = Object.freeze({ key, name });
    this.#tags.set(key, tag);
    return ok(tag);
  }

  has(key: string): boolean {
    return this.#tags.has(key);
  }

  ensureProperty(tagKey: string, key: string, type: PropertyType): EnsureTagPropertyResult {
    if (!this.has(tagKey)) return err({ type: "tag-not-found" });
    const definitions = this.#properties.get(tagKey) ?? new Map<string, TagProperty>();
    const existing = definitions.get(key);
    if (existing !== undefined) {
      if (existing.type !== type) {
        return err({ type: "property-type-conflict", tagKey, propertyKey: key });
      }
      return ok(existing);
    }
    const definition = Object.freeze({ tagKey, key, type });
    definitions.set(key, definition);
    this.#properties.set(tagKey, definitions);
    return ok(definition);
  }

  validateValues(
    tagKey: string,
    values: PropertyValues,
  ): Result<PropertyValues, PropertyValueError> {
    if (!this.has(tagKey)) return err({ type: "tag-not-found" });
    return validateValues(
      tagKey,
      this.#properties.get(tagKey) ?? new Map<string, TagProperty>(),
      values,
    );
  }
}
