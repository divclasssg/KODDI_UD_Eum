import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as sass from "sass";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const fromProjectRoot = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFile(fromProjectRoot(path), "utf8");

const approvedPrimitiveTokens = {
  "--color-teal-100": "#e5f3f4",
  "--color-teal-200": "#a1cdcf",
  "--color-teal-300": "#73b3b7",
  "--color-teal-400": "#449a9f",
  "--color-teal-500": "#158187",
  "--color-teal-600": "#11676c",
  "--color-teal-700": "#0d4d51",
  "--color-teal-800": "#083436",
  "--color-teal-900": "#041a1b",
  "--color-white": "#ffffff",
  "--color-neutral-100": "#fbfbfb",
  "--color-neutral-200": "#f1f1f2",
  "--color-neutral-300": "#c2c4cd",
  "--color-neutral-400": "#878b9b",
  "--color-neutral-500": "#7a7e8e",
  "--color-neutral-600": "#626572",
  "--color-neutral-700": "#3f424e",
  "--color-neutral-800": "#2a2c34",
  "--color-neutral-900": "#15161a",
  "--color-red-100": "#fff1f0",
  "--color-red-700": "#a61b1b",
  "--color-amber-100": "#fff7e0",
  "--color-amber-600": "#a65f00",
  "--color-amber-700": "#704000",
  ...Object.fromEntries(
    [0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64].map(
      (value) => [`--measure-${value}`, `${value}px`],
    ),
  ),
};

const approvedSemanticTokens = {
  "--color-text-brand": "var(--color-teal-500)",
  "--color-text-primary": "var(--color-neutral-800)",
  "--color-text-secondary": "var(--color-neutral-700)",
  "--color-text-tertiary": "var(--color-neutral-600)",
  "--color-text-on-primary": "var(--color-white)",
  "--color-text-disabled": "var(--color-neutral-300)",
  "--color-text-placeholder": "var(--color-neutral-600)",
  "--color-bg-brand-primary": "var(--color-teal-500)",
  "--color-bg-brand-secondary": "var(--color-teal-100)",
  "--color-bg-brand-disabled": "var(--color-teal-200)",
  "--color-bg-primary": "var(--color-white)",
  "--color-bg-secondary": "var(--color-neutral-100)",
  "--color-bg-disabled": "var(--color-neutral-200)",
  "--color-border-brand": "var(--color-teal-500)",
  "--color-border-brand-subtle": "var(--color-teal-200)",
  "--color-border-default": "var(--color-neutral-400)",
  "--color-border-secondary": "var(--color-neutral-600)",
  "--color-border-subtle": "var(--color-neutral-300)",
  "--color-icon-brand": "var(--color-teal-500)",
  "--color-icon-primary": "var(--color-neutral-800)",
  "--color-icon-secondary": "var(--color-neutral-600)",
  "--color-icon-tertiary": "var(--color-neutral-400)",
  "--color-icon-on-primary": "var(--color-white)",
  "--color-icon-disabled": "var(--color-neutral-300)",
  "--color-bg-error": "var(--color-red-100)",
  "--color-text-error": "var(--color-red-700)",
  "--color-icon-error": "var(--color-red-700)",
  "--color-border-error": "var(--color-red-700)",
  "--color-bg-warning": "var(--color-amber-100)",
  "--color-text-warning": "var(--color-amber-700)",
  "--color-icon-warning": "var(--color-amber-700)",
  "--color-border-warning": "var(--color-amber-600)",
  "--color-bg-success": "var(--color-teal-100)",
  "--color-text-success": "var(--color-teal-700)",
  "--color-icon-success": "var(--color-teal-700)",
  "--color-border-success": "var(--color-teal-500)",
  "--color-bg-info": "var(--color-neutral-100)",
  "--color-text-info": "var(--color-neutral-800)",
  "--color-icon-info": "var(--color-neutral-800)",
  "--color-border-info": "var(--color-neutral-600)",
  ...Object.fromEntries(
    [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64].map((value) => [
      `--space-${value}`,
      `var(--measure-${value})`,
    ]),
  ),
  "--radius-sm": "var(--measure-2)",
  "--radius-md": "var(--measure-4)",
  "--radius-lg": "var(--measure-8)",
  "--radius-xl": "var(--measure-12)",
  "--radius-2xl": "var(--measure-16)",
  "--radius-rounded": "9999px",
  "--size-touch-target-min": "var(--measure-48)",
  "--size-control-min-height": "var(--measure-48)",
};

const typeRoles = {
  h1: [28, 1.35],
  h2: [24, 1.4],
  "sub-01": [22, 1.45],
  "sub-02": [20, 1.45],
  "body-01": [18, 1.6],
  "body-02": [16, 1.6],
  "caption-01": [14, 1.5],
  "caption-02": [12, 1.5],
};

const approvedTypographyTokens = {
  "--font-family-sans": "var(--font-pretendard)",
  "--font-weight-regular": "400",
  "--font-weight-medium": "500",
  "--font-weight-semibold": "600",
  ...Object.fromEntries(
    [12, 14, 16, 18, 20, 22, 24, 28].map((value) => [
      `--font-size-${value}`,
      `${value}px`,
    ]),
  ),
  "--letter-spacing-default": "0",
  ...Object.fromEntries(
    Object.entries(typeRoles).flatMap(([role, [size, lineHeight]]) => [
      [`--type-${role}-size`, `var(--font-size-${size})`],
      [`--type-${role}-weight-regular`, "var(--font-weight-regular)"],
      [`--type-${role}-weight-medium`, "var(--font-weight-medium)"],
      [`--type-${role}-weight-semibold`, "var(--font-weight-semibold)"],
      [`--type-${role}-line-height`, String(lineHeight)],
    ]),
  ),
  "--type-h1-letter-spacing": "var(--letter-spacing-default)",
};

const approvedTokenMap = {
  ...approvedPrimitiveTokens,
  ...approvedSemanticTokens,
  ...approvedTypographyTokens,
};

const extractCustomProperties = (css) =>
  Object.fromEntries(
    [...css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map(
      ([, name, value]) => [name, value.trim()],
    ),
  );

const relativeLuminance = (hex) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (first, second) => {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
};

const listSassFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return listSassFiles(path);
      return /\.s[ac]ss$/i.test(entry.name) ? [path] : [];
    }),
  );
  return files.flat();
};

test("the globals.scss graph compiles to the complete approved token map", () => {
  const { css } = sass.compile(`${projectRoot}src/app/globals.scss`, {
    style: "expanded",
  });

  assert.deepEqual(extractCustomProperties(css), approvedTokenMap);
});

test("the application emits one light theme and consumers use semantic tokens", async () => {
  const { css } = sass.compile(`${projectRoot}src/app/globals.scss`, {
    style: "expanded",
  });
  const sassFiles = (await listSassFiles(`${projectRoot}src`)).filter(
    (path) =>
      !path.includes("/src/styles/tokens/") &&
      !path.endsWith("/src/styles/_tokens.scss"),
  );
  const sources = await Promise.all(
    sassFiles.map(async (path) => [path, await readFile(path, "utf8")]),
  );
  const applicationScss = sources.map(([, source]) => source).join("\n");

  assert.doesNotMatch(
    css,
    /prefers-color-scheme|color-scheme\s*:\s*dark|\[data-theme=["']?dark|\.dark\b/i,
  );
  assert.doesNotMatch(
    applicationScss,
    /prefers-color-scheme|color-scheme\s*:\s*dark|\[data-theme=["']?dark|\.dark\b/i,
  );

  const rawColorPattern =
    /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(/i;
  const primitiveNames = [
    ...Object.keys(approvedPrimitiveTokens),
    ...Object.keys(approvedTypographyTokens).filter(
      (name) => !name.startsWith("--type-") && name !== "--font-family-sans",
    ),
    "--font-pretendard",
  ];
  const directPrimitivePattern = new RegExp(
    `var\\(\\s*(?:${primitiveNames.join("|")})(?:\\s*,|\\s*\\))`,
  );

  for (const [path, source] of sources) {
    assert.doesNotMatch(source, rawColorPattern, `Raw color found in ${path}`);
    assert.doesNotMatch(
      source,
      directPrimitivePattern,
      `Direct primitive token use found in ${path}`,
    );
  }
});

test("approved status text and borders meet their contrast thresholds", () => {
  const statusPairs = [
    ["#a61b1b", "#fff1f0", "#a61b1b"],
    ["#704000", "#fff7e0", "#a65f00"],
    ["#0d4d51", "#e5f3f4", "#158187"],
    ["#2a2c34", "#fbfbfb", "#626572"],
  ];

  for (const [textColor, backgroundColor, borderColor] of statusPairs) {
    assert.ok(contrastRatio(textColor, backgroundColor) >= 4.5);
    assert.ok(contrastRatio(borderColor, backgroundColor) >= 3);
  }
});

test("Pretendard 1.3.9 is pinned and self-hosted through next/font/local", async () => {
  const [layout, license, font, fontMetadata] = await Promise.all([
    read("src/app/layout.tsx"),
    read("src/app/fonts/Pretendard-LICENSE.txt"),
    readFile(fromProjectRoot("src/app/fonts/PretendardVariable.woff2")),
    stat(fromProjectRoot("src/app/fonts/PretendardVariable.woff2")),
  ]);

  assert.match(layout, /from "next\/font\/local"/);
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(layout, /src:\s*"\.\/fonts\/PretendardVariable\.woff2"/);
  assert.match(layout, /weight:\s*"45 920"/);
  assert.match(layout, /display:\s*"swap"/);
  assert.match(layout, /variable:\s*"--font-pretendard"/);
  assert.match(layout, /adjustFontFallback:\s*false/);
  assert.match(
    layout,
    /<html lang="ko" className=\{pretendard\.variable\}>/,
  );

  const fallbackMatch = layout.match(/fallback:\s*\[([\s\S]*?)\]/);
  assert.ok(fallbackMatch, "Missing localFont fallback array");
  const fallbackValues = [
    ...fallbackMatch[1].matchAll(/(["'])(.*?)\1/g),
  ].map(([, , value]) => value);
  const nonLiteralFallbackContent = fallbackMatch[1]
    .replace(/(["'])(.*?)\1/g, "")
    .replace(/[\s,]/g, "");
  assert.equal(
    nonLiteralFallbackContent,
    "",
    "Fallback entries must be string literals",
  );
  assert.deepEqual(fallbackValues, [
    "system-ui",
    "Apple SD Gothic Neo",
    "Noto Sans KR",
    "Malgun Gothic",
    "sans-serif",
  ]);

  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.ok(fontMetadata.size > 1_000_000, "Pretendard variable font is incomplete");
  assert.equal(
    createHash("sha256").update(font).digest("hex"),
    "9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4",
  );
});
