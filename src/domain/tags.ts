import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

export type Tag = Readonly<{ key: string; name: string }>;

export type EnsureTagResult = Result<Tag, "tag-name-conflict">;

export class Tags {
  readonly #tags = new Map<string, Tag>();

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
}
