import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("공통 아이콘 기반은 크기와 접근성 정책을 고정한다", async () => {
  const [base, types] = await Promise.all([
    read("src/components/icons/_internal/IconBase.tsx"),
    read("src/components/icons/_internal/icon.types.ts"),
  ]);

  assert.match(base, /aria-hidden="true"/);
  assert.match(base, /focusable="false"/);
  assert.doesNotMatch(base, /\.\.\.[a-zA-Z]/);
  assert.doesNotMatch(base, /["']use client["']/);
  assert.match(types, /weight\?: "regular" \| "bold"/);
  assert.match(types, /variant\?: "outline" \| "filled"/);
  assert.match(types, /size\?: 24 \| 32/);
  assert.match(types, /[가-힣]/u);
});
