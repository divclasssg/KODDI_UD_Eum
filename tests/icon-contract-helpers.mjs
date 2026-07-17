import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fromProjectRoot = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFile(fromProjectRoot(path), "utf8");

export const assertIconGroup = async (entries) => {
  const [indexSource, designSpec] = await Promise.all([
    read("src/components/icons/index.ts"),
    read("docs/superpowers/specs/2026-07-17-icon-system-design.md"),
  ]);

  for (const entry of entries) {
    const source = await read(`src/components/icons/${entry.file}.tsx`);
    assert.match(source, /\/\*\*[\s\S]*[가-힣][\s\S]*\*\//u);
    assert.match(
      indexSource,
      new RegExp(`export \\{ ${entry.component} \\} from "\\./${entry.file}";`),
    );
    assert.ok(designSpec.includes(entry.mappingLine));
    assert.doesNotMatch(source, /["']use client["']/);
    assert.doesNotMatch(source, /<title\b|aria-label\s*=/);
    assert.doesNotMatch(source, /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\(/i);
    if (entry.currentColor !== false) assert.match(source, /currentColor/);
  }
};
