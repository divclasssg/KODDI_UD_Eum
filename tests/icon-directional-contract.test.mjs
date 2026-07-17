import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertIconGroup } from "./icon-contract-helpers.mjs";

const icons = [
  ["Caret_Down_MD", "2009:3567", "CaretDownIcon"],
  ["Caret_Up_MD", "2009:3570", "CaretUpIcon"],
  ["Chevron_Up", "2009:3579", "ChevronUpIcon"],
  ["Chevron_Down", "2009:3576", "ChevronDownIcon"],
  ["Chevron_Left_MD", "2009:3573", "CaretLeftIcon"],
  ["Arrow", "2009:3582", "ChevronLeftIcon"],
  ["Chevron_Right", "2009:3595", "ChevronRightIcon"],
  ["Arrow_Up", "2016:2187", "ArrowUpIcon"],
  ["Close_LG", "2009:8470", "CloseIcon"],
  ["Circle", "2009:8698", "CircleIcon"],
  ["Triangle", "2009:8695", "TriangleIcon"],
  ["Arrow_Undo_Up_Right", "2009:8718", "UndoUpRightIcon"],
].map(([figmaName, nodeId, component]) => ({
  component,
  file: component,
  mappingLine: `| ${figmaName} | \`${nodeId}\` | \`${component}\` |`,
}));

test("방향과 기본 도형 아이콘은 승인된 공개 계약을 따른다", async () => {
  await assertIconGroup(icons);
});

test("CircleIcon은 승인된 24px 원형을 공유하고 굵기만 전환한다", async () => {
  const source = await readFile(
    new URL("../src/components/icons/CircleIcon.tsx", import.meta.url),
    "utf8",
  );
  const paths = [...source.matchAll(/<path\b[\s\S]*?\/>/g)];
  const approvedPath =
    "M3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12Z";

  assert.match(source, /viewBox\s*=\s*["']0\s+0\s+24\s+24["']/);
  assert.equal(paths.length, 1);
  const pathSource = paths.at(0)?.[0];
  assert.ok(pathSource);
  const pathData = pathSource.match(/\bd\s*=\s*["']([^"']+)["']/)?.[1];
  assert.equal(pathData?.replace(/\s+/g, " ").trim(), approvedPath);
  assert.match(
    pathSource,
    /strokeWidth\s*=\s*\{\s*weight\s*===\s*["']bold["']\s*\?\s*2\s*:\s*1\.4\s*\}/,
  );
});
