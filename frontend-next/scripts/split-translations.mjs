/**
 * One-off helper: split lib/i18n/translations.ts into messages/{pl,en}/*.ts modules.
 * Run from frontend-next: node scripts/split-translations.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = path.join(root, "lib/i18n/translations.ts");
const src = fs.readFileSync(srcPath, "utf8");

const MODULE_BY_COMMENT = [
  [/App\/Nav|Profile modal|MemberPicker|Profil/i, "app"],
  [/Login/i, "login"],
  [/Calendar/i, "calendar"],
  [/Recipes/i, "recipes"],
  [/Products/i, "products"],
  [/Summary|DrinksCard|Wydatki|Expenses — drinks/i, "summary"],
  [/Export/i, "export"],
  [/MacroCalculator/i, "macro"],
  [/Rozkład dnia|Daily schedule/i, "schedule"],
];

function extractLocaleBlock(locale) {
  if (locale === "pl") {
    const match = src.match(/pl:\s*\{([\s\S]*?)\n  \},\n  en:/);
    if (!match) throw new Error("Could not extract pl block");
    return match[1];
  }
  const match = src.match(/en:\s*\{([\s\S]*?)\n  \},\n\} as const/);
  if (!match) throw new Error("Could not extract en block");
  return match[1];
}

function slugForComment(comment) {
  for (const [pattern, slug] of MODULE_BY_COMMENT) {
    if (pattern.test(comment)) return slug;
  }
  return "misc";
}

function splitIntoModules(block) {
  const lines = block.split("\n");
  const modules = new Map();
  let currentSlug = "app";
  let currentLines = [];

  const flush = () => {
    if (currentLines.length === 0) return;
    const body = currentLines.join("\n").trim();
    if (!body) return;
    const prev = modules.get(currentSlug) ?? "";
    modules.set(currentSlug, prev ? `${prev}\n${body}` : body);
    currentLines = [];
  };

  for (const line of lines) {
    const commentMatch = line.match(/^\s+\/\/ (.+)$/);
    if (commentMatch) {
      flush();
      currentSlug = slugForComment(commentMatch[1]);
      continue;
    }
    if (line.trim()) currentLines.push(line);
  }
  flush();
  return modules;
}

function writeLocale(locale, modules) {
  const dir = path.join(root, "lib/i18n/messages", locale);
  fs.mkdirSync(dir, { recursive: true });

  const imports = [];
  const spreads = [];

  for (const slug of [...modules.keys()].sort()) {
    const body = modules.get(slug);
    const exportName = `${slug}Messages`;
    const filePath = path.join(dir, `${slug}.ts`);
    fs.writeFileSync(
      filePath,
      `export const ${exportName} = {\n${body}\n};\n`,
    );
    imports.push(`import { ${exportName} } from "./${slug}";`);
    spreads.push(`  ...${exportName},`);
  }

  fs.writeFileSync(
    path.join(dir, "index.ts"),
    `${imports.join("\n")}\n\nexport const ${locale}Messages = {\n${spreads.join("\n")}\n} as const;\n`,
  );
}

for (const locale of ["pl", "en"]) {
  const block = extractLocaleBlock(locale);
  const modules = splitIntoModules(block);
  writeLocale(locale, modules);
  console.log(`${locale}: ${modules.size} modules, ${[...modules.values()].join("").match(/^\s+\w+:/gm)?.length ?? 0} keys`);
}

console.log("Done. Update lib/i18n/translations.ts to import from messages/.");
