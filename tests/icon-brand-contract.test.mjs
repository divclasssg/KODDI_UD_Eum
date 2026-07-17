import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Logo는 브랜드 크기와 장식용 접근성 계약을 지킨다", async () => {
  const [source, designSpec] = await Promise.all([
    readFile(new URL("../src/components/brand/Logo.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../docs/superpowers/specs/2026-07-17-icon-system-design.md",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(source, /\/\*\*[\s\S]*[가-힣][\s\S]*\*\//u);
  assert.match(source, /width=\{48\}/);
  assert.match(source, /height=\{32\}/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /focusable="false"/);
  assert.doesNotMatch(source, /<title\b|aria-label\s*=|["']use client["']/);
  assert.ok(designSpec.includes("| Logo | `2009:8683` | `Logo` |"));
});
