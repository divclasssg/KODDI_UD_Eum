import test from "node:test";
import { assertIconGroup } from "./icon-contract-helpers.mjs";

const icons = [
  ["Lock_Open", "2009:8732", "LockOpenIcon"],
  ["Image", "2009:8744", "ImageAddIcon"],
  ["Voice", "2009:8756", "MicrophoneIcon"],
  ["File", "2009:8768", "FileTextIcon"],
  ["Edit", "2009:8782", "EditIcon"],
  ["Edit_pencile", "2009:8796", "EditPencilIcon"],
  ["File 중복", "2016:2201", "FileTextIcon"],
  ["Lock", "2016:2215", "LockIcon"],
  ["search", "2025:3699", "SearchIcon"],
].map(([figmaName, nodeId, component]) => ({
  component,
  file: component,
  mappingLine:
    `| ${figmaName} | \`${nodeId}\` | \`${component}\`` +
    (figmaName === "File 중복" ? "으로 통합 |" : " |"),
}));

test("동작과 콘텐츠 아이콘은 승인된 공개 계약을 따른다", async () => {
  await assertIconGroup(icons);
});
