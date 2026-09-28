import path from "node:path";

import { defineJob } from "../../define-job";
import type { Source } from "../../types";
import { Codeowners } from "./codeowners";

interface CodeownersJobOptions {
  output?: string;
  input?: string[];
}

const DEFAULT_FROM_PATTERN = ["**/CODEOWNERS"];
const DEFAULT_OUTPUT_PATH = ".github/CODEOWNERS";

export const codeownersJob = defineJob((options?: CodeownersJobOptions) => ({
  name: "codeowners",
  input: options?.input ?? DEFAULT_FROM_PATTERN,
  output: options?.output ?? DEFAULT_OUTPUT_PATH,
  transform: (inputFiles, { rootDir }) => {
    const sortedInputFiles = sortByDirectory(inputFiles, rootDir);

    const codeowners = Codeowners.merge(
      sortedInputFiles.map((inputFile) => {
        const baseDir = path.relative(
          rootDir,
          path.dirname(path.resolve(rootDir, inputFile.path)),
        );

        return Codeowners.from(inputFile.contents).map(
          ({ pattern, owners }) => ({
            pattern: toAbsolutePattern(pattern, baseDir),
            owners,
          }),
        );
      }),
    );

    if (codeowners.isEmpty()) {
      return "";
    }

    return codeowners.stringify();
  },
}));

// Windows accepts both separators; on POSIX, backslashes can be part of a name.
const pathSeparator = path.sep === "\\" ? /[\\/]/ : path.sep;

// Compare directory segments to keep parents before their descendants.
const sortByDirectory = (inputFiles: Source[], rootDir: string): Source[] =>
  inputFiles
    .map((file) => {
      const relativePath = path.isAbsolute(file.path)
        ? path.relative(rootDir, file.path)
        : file.path;
      const directoryPath = path.dirname(relativePath);
      return {
        file,
        segments:
          directoryPath === "." ? [] : directoryPath.split(pathSeparator),
      };
    })
    .sort((a, b) => {
      const length = Math.min(a.segments.length, b.segments.length);
      for (let index = 0; index < length; index++) {
        const left = a.segments[index]!;
        const right = b.segments[index]!;
        if (left !== right) {
          return left.localeCompare(right) || (left < right ? -1 : 1);
        }
      }

      return (
        a.segments.length - b.segments.length ||
        a.file.path.localeCompare(b.file.path)
      );
    })
    .map(({ file }) => file);

const toAbsolutePattern = (pattern: string, baseDir: string) => {
  const base = baseDir !== "" ? `/${baseDir}` : "";
  return pattern === "*" ? `${base}/` : `${base}/${stripLeadingSlash(pattern)}`;
};

const stripLeadingSlash = (text: string) => text.replace(/^\//, "");
