import { expect, it } from "vitest";
import { ok } from "neverthrow";
import { Core } from "../src/index";

it("ensureTagが返したタグの名前やキーを書き換えようとしても、タグの内容は変わらない", () => {
  const core = new Core();
  const result = core.ensureTag("hoge", "Hoge");
  expect(result.isOk()).toBe(true);
  if (result.isErr()) throw new Error("expected a tag");

  expect(Reflect.set(result.value, "name", "Corrupted")).toBe(false);
  expect(Reflect.set(result.value, "key", "other-key")).toBe(false);
  expect(core.ensureTag("hoge", "Hoge")).toEqual(ok({ key: "hoge", name: "Hoge" }));
});

it("異なるCoreインスタンスでは、同じキーに別々の名前でタグを登録できる", () => {
  const first = new Core();
  const second = new Core();

  expect(first.ensureTag("hoge", "First")).toEqual(ok({ key: "hoge", name: "First" }));
  expect(second.ensureTag("hoge", "Second")).toEqual(ok({ key: "hoge", name: "Second" }));
  expect(first.ensureTag("hoge", "First")).toEqual(ok({ key: "hoge", name: "First" }));
});
