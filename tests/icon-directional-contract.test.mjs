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
