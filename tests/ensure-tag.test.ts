import { describe, expect, expectTypeOf, it } from "vitest";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { Core } from "../src/index";
import type { EnsureTagResult, Tag } from "../src/index";

describe("ensureTag through the public SDK", () => {
  it("creates a tag for a new key, preserving the supplied key and name", () => {
    const core = new Core();

    expectTypeOf<EnsureTagResult>().toEqualTypeOf<Result<Tag, "tag-name-conflict">>();
    const result = core.ensureTag("topic:key", "Name");
    expect(result).toEqual(ok({ key: "topic:key", name: "Name" }));
    expect(result.isOk()).toBe(true);
    expect(
      result
        .map((tag) => tag.key)
        .match(
          (key) => key,
          (error) => error,
        ),
    ).toBe("topic:key");
  });

  it("is idempotent for the same key and name", () => {
    const core = new Core();
    const expected = ok({ key: "hoge", name: "Hoge" });

    expect(core.ensureTag("hoge", "Hoge")).toEqual(expected);
    expect(core.ensureTag("hoge", "Hoge")).toEqual(expected);
  });

  it("rejects a conflicting name without changing existing tags", () => {
    const core = new Core();
    const expected = ok({ key: "hoge", name: "Hoge" });
    const unrelated = ok({ key: "notes", name: "Notes" });

    expect(core.ensureTag("hoge", "Hoge")).toEqual(expected);
    expect(core.ensureTag("notes", "Notes")).toEqual(unrelated);
    const conflict = core.ensureTag("hoge", "Renamed");
    expect(conflict).toEqual(err("tag-name-conflict"));
    expect(conflict.isErr()).toBe(true);
    expect(
      conflict.match(
        (tag) => tag.name,
        (error) => error,
      ),
    ).toBe("tag-name-conflict");
    expect(core.ensureTag("hoge", "Renamed")).toEqual(err("tag-name-conflict"));
    expect(core.ensureTag("notes", "Renamed Notes")).toEqual(err("tag-name-conflict"));
    expect(core.ensureTag("hoge", "Hoge")).toEqual(expected);
    expect(core.ensureTag("notes", "Notes")).toEqual(unrelated);
  });

  it("allows different keys to have the same name", () => {
    const core = new Core();

    expect(core.ensureTag("key:one", "same name")).toEqual(
      ok({ key: "key:one", name: "same name" }),
    );
    expect(core.ensureTag("key:two", "same name")).toEqual(
      ok({ key: "key:two", name: "same name" }),
    );
    expect(core.ensureTag("key:one", "same name")).toEqual(
      ok({ key: "key:one", name: "same name" }),
    );
  });
});
