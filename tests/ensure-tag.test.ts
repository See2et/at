import { describe, expect, expectTypeOf, it } from "vitest";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { Core } from "../src/index";
import type { EnsureTagResult, Tag } from "../src/index";

describe("公開SDKのensureTagによるタグの作成・取得", () => {
  it("未登録のキーを指定すると、指定したキーと名前のタグを作成して返す", () => {
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

  it("同じキーと名前で繰り返し呼び出すと、同じ内容のタグを返す", () => {
    const core = new Core();
    const expected = ok({ key: "hoge", name: "Hoge" });

    expect(core.ensureTag("hoge", "Hoge")).toEqual(expected);
    expect(core.ensureTag("hoge", "Hoge")).toEqual(expected);
  });

  it("登録済みのキーに異なる名前を指定すると、既存のタグを変更せずtag-name-conflictを返す", () => {
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

  it("異なるキーに同じ名前を指定すると、それぞれのキーでタグを作成できる", () => {
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
