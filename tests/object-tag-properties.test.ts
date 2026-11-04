import { describe, expect, expectTypeOf, it } from "vitest";
import { err, ok } from "neverthrow";
import { Core } from "../src/index";
import type { PropertyValues } from "../src/index";

function taskCore() {
  const core = new Core();
  expect(core.ensureTag("task", "タスク").isOk()).toBe(true);
  expect(core.ensureTagProperty("task", "memo", "string").isOk()).toBe(true);
  expect(core.ensureTagProperty("task", "priority", "number").isOk()).toBe(true);
  return core;
}

describe("Object and Tag properties through the public SDK", () => {
  it("creates distinct objects with the supplied title and Markdown, including empty bodies", () => {
    const core = new Core();
    const first = core.createObject("牛乳を買う", "## メモ\n- 帰りに買う");
    const second = core.createObject("牛乳を買う", "");

    expect(first).toEqual({
      id: expect.any(String),
      title: "牛乳を買う",
      body: "## メモ\n- 帰りに買う",
    });
    expect(second).toEqual({ id: expect.any(String), title: "牛乳を買う", body: "" });
    expect(second.id).not.toBe(first.id);
    expect(core.getObject(first.id)).toEqual(ok(first));
  });

  it("attaches initial values, updates only specified values, and returns current values on reattachment", () => {
    const core = taskCore();
    const object = core.createObject("牛乳を買う", "");
    const initial = {
      objectId: object.id,
      tagKey: "task",
      properties: { memo: "帰りに買う", priority: 3 },
    };
    expect(core.attachTag(object.id, "task", initial.properties)).toEqual(ok(initial));
    const current = { ...initial, properties: { memo: "帰りに買う", priority: 5 } };
    expect(core.updateTagProperties(object.id, "task", { priority: 5 })).toEqual(ok(current));
    expect(core.attachTag(object.id, "task", { priority: 3 })).toEqual(
      err({ type: "tag-already-attached", attachment: current }),
    );
    expect(core.getTagAttachment(object.id, "task")).toEqual(ok(current));
  });

  it("keeps definitions local to a Tag and preserves definitions and values on a type conflict", () => {
    const core = taskCore();
    const definition = { tagKey: "task", key: "priority", type: "number" };
    expect(core.ensureTagProperty("task", "priority", "number")).toEqual(ok(definition));
    expect(core.ensureTag("notes", "メモ").isOk()).toBe(true);
    expect(core.ensureTagProperty("notes", "priority", "string").isOk()).toBe(true);
    const object = core.createObject("メモ", "");
    expect(core.attachTag(object.id, "task", { priority: 3 }).isOk()).toBe(true);
    expect(core.attachTag(object.id, "notes", { priority: "低" }).isOk()).toBe(true);

    expect(core.ensureTagProperty("task", "priority", "string")).toEqual(
      err({ type: "property-type-conflict", tagKey: "task", propertyKey: "priority" }),
    );
    expect(core.getTagAttachment(object.id, "task")).toEqual(
      ok({ objectId: object.id, tagKey: "task", properties: { priority: 3 } }),
    );
    expect(core.updateTagProperties(object.id, "task", { priority: "高" }).isErr()).toBe(true);
    expect(core.ensureTagProperty("task", "priority", "number")).toEqual(ok(definition));
    expect(core.updateTagProperties(object.id, "task", { priority: -1.5 }).isOk()).toBe(true);
    expect(core.getTagAttachment(object.id, "notes")).toEqual(
      ok({ objectId: object.id, tagKey: "notes", properties: { priority: "低" } }),
    );
  });

  it("distinguishes unset values from zero and empty strings", () => {
    const core = taskCore();
    const first = core.createObject("未設定", "");
    const second = core.createObject("設定済み", "");
    expect(core.attachTag(first.id, "task")).toEqual(
      ok({ objectId: first.id, tagKey: "task", properties: {} }),
    );
    expect(core.attachTag(second.id, "task", { memo: "", priority: 0 })).toEqual(
      ok({ objectId: second.id, tagKey: "task", properties: { memo: "", priority: 0 } }),
    );
  });

  it("rejects missing targets and unattached updates without implicit creation", () => {
    const core = taskCore();
    const object = core.createObject("未付与", "");
    expect(core.attachTag("missing", "task")).toEqual(err({ type: "object-not-found" }));
    expect(core.getObject("missing")).toEqual(err({ type: "object-not-found" }));
    expect(core.attachTag(object.id, "missing")).toEqual(err({ type: "tag-not-found" }));
    expect(core.ensureTagProperty("missing", "memo", "string")).toEqual(
      err({ type: "tag-not-found" }),
    );
    expect(core.getTagAttachment(object.id, "missing")).toEqual(err({ type: "tag-not-found" }));
    expect(core.updateTagProperties("missing", "task", {})).toEqual(
      err({ type: "object-not-found" }),
    );
    expect(core.updateTagProperties(object.id, "missing", {})).toEqual(
      err({ type: "tag-not-found" }),
    );
    expect(core.updateTagProperties(object.id, "task", { memo: "書き込み" })).toEqual(
      err({ type: "tag-not-attached" }),
    );
    expect(core.getTagAttachment(object.id, "task")).toEqual(err({ type: "tag-not-attached" }));
  });

  it("rejects mixed invalid initial values without attaching or retaining a partial value", () => {
    const core = taskCore();
    const object = core.createObject("買い物", "");
    expect(core.attachTag(object.id, "task", { memo: "残してはいけない", priority: "高" })).toEqual(
      err({
        type: "invalid-property-value",
        tagKey: "task",
        propertyKey: "priority",
        expected: "number",
      }),
    );
    expect(core.getTagAttachment(object.id, "task")).toEqual(err({ type: "tag-not-attached" }));
    expect(core.attachTag(object.id, "task", { priority: 3 })).toEqual(
      ok({ objectId: object.id, tagKey: "task", properties: { priority: 3 } }),
    );
  });

  it("rejects mixed updates atomically, including unknown properties", () => {
    const core = taskCore();
    const object = core.createObject("買い物", "");
    const current = {
      objectId: object.id,
      tagKey: "task",
      properties: { memo: "元の値", priority: 3 },
    };
    expect(core.attachTag(object.id, "task", current.properties)).toEqual(ok(current));
    expect(
      core.updateTagProperties(object.id, "task", { memo: "変更", priority: "高" }).isErr(),
    ).toBe(true);
    expect(core.getTagAttachment(object.id, "task")).toEqual(ok(current));
    expect(core.updateTagProperties(object.id, "task", { memo: "変更", unknown: 1 })).toEqual(
      err({ type: "property-not-defined", tagKey: "task", propertyKey: "unknown" }),
    );
    expect(core.getTagAttachment(object.id, "task")).toEqual(ok(current));
    expect(core.ensureTagProperty("task", "unknown", "string").isOk()).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity, "3"])(
    "rejects non-finite numbers or numeric strings (%s)",
    (priority) => {
      const core = taskCore();
      const object = core.createObject("買い物", "");
      expect(core.attachTag(object.id, "task", { priority }).isErr()).toBe(true);
      expect(core.getTagAttachment(object.id, "task")).toEqual(err({ type: "tag-not-attached" }));
    },
  );

  it("returns an already-attached error before considering any new initial values", () => {
    const core = taskCore();
    const object = core.createObject("買い物", "");
    const current = { objectId: object.id, tagKey: "task", properties: { priority: 5 } };
    expect(core.attachTag(object.id, "task", current.properties)).toEqual(ok(current));
    expect(core.attachTag(object.id, "task")).toEqual(
      err({ type: "tag-already-attached", attachment: current }),
    );
    expect(core.attachTag(object.id, "task", { priority: NaN, unknown: "不正" })).toEqual(
      err({ type: "tag-already-attached", attachment: current }),
    );
  });

  it("does not expose writable state through inputs, returned objects, definitions, or error attachments", () => {
    const core = taskCore();
    const object = core.createObject("買い物", "本文");
    const values = { memo: "元", priority: 3 };
    const attached = core.attachTag(object.id, "task", values)._unsafeUnwrap();
    values.memo = "外部変更";
    expect(Reflect.set(object, "title", "外部変更")).toBe(false);
    expect(core.getObject(object.id)).toEqual(ok({ id: object.id, title: "買い物", body: "本文" }));
    const definition = core.ensureTagProperty("task", "memo", "string")._unsafeUnwrap();
    expect(Reflect.set(definition, "type", "number")).toBe(false);
    expect(Reflect.set(attached, "tagKey", "other")).toBe(false);
    expect(Reflect.set(attached.properties, "memo", "外部変更")).toBe(false);
    expectTypeOf(attached.properties).toEqualTypeOf<PropertyValues>();
    const patch = { priority: 5 };
    const updated = core.updateTagProperties(object.id, "task", patch)._unsafeUnwrap();
    patch.priority = 99;
    const duplicate = core.attachTag(object.id, "task");
    expect(duplicate.isErr()).toBe(true);
    if (duplicate.isOk() || duplicate.error.type !== "tag-already-attached")
      throw new Error("expected current attachment");
    expect(Reflect.set(duplicate.error.attachment.properties, "priority", 99)).toBe(false);
    expect(core.getTagAttachment(object.id, "task")).toEqual(ok(updated));
    expect(updated.properties).toEqual({ memo: "元", priority: 5 });
    expect(attached.properties).toEqual({ memo: "元", priority: 3 });

    const other = taskCore();
    expect(other.getTagAttachment(object.id, "task")).toEqual(err({ type: "object-not-found" }));
    const otherObject = other.createObject("独立", "");
    expect(other.attachTag(otherObject.id, "task", { memo: "別" }).isOk()).toBe(true);
    expect(core.getTagAttachment(object.id, "task")).toEqual(ok(updated));
  });
});
