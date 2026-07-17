import test from "node:test";
import { assertIconGroup } from "./icon-contract-helpers.mjs";

const icons = [
  ["History", "2009:8530", "ClockIcon"],
  ["Profile", "2009:8533", "UserIcon"],
  ["Home", "2009:8536", "MessageIcon"],
].map(([figmaName, nodeId, component]) => ({
  component,
  file: component,
  mappingLine: `| ${figmaName} | \`${nodeId}\` | \`${component}\` |`,
}));

test("내비게이션 아이콘은 색상 상태를 부모에게 위임한다", async () => {
  await assertIconGroup(icons);
});
