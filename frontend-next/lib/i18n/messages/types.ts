/** A single UI message — plain string, string list, or formatter function. */
export type TranslationValue =
  | string
  | readonly string[]
  | ((...args: (string | number | boolean)[]) => string);

export type MessageModule = Record<string, TranslationValue>;
