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
  assert.match(
    source,
    /<circle\s+cx=\{16\}\s+cy=\{16\}\s+r=\{16\}\s+fill="#16A9B1"\s*\/>/,
  );
  assert.match(
    source,
    /<path\s+d="M16 16C16 7\.16344 23\.1634 0 32 0C40\.8366 0 48 7\.16344 48 16V32H32C23\.1634 32 16 24\.8366 16 16Z"\s+fill="#545FD6"\s+fillOpacity=\{0\.3\}\s*\/>/,
  );
  assert.equal(source.match(/<(?:circle|path)\b/g)?.length, 2);
  assert.doesNotMatch(
    source,
    /d="M32 16C32 24\.8366 24\.8366 32 16 32C7\.16344/,
  );
  assert.doesNotMatch(source, /<title\b|aria-label\s*=|["']use client["']/);
  assert.ok(designSpec.includes("| Logo | `2009:8683` | `Logo` |"));
});
