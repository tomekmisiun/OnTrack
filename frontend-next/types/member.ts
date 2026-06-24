export type MacroGoals = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  goalLabel: string | null;
};

export type Member = {
  id: number;
  name: string;
  is_primary: boolean;
  gender: string | null;
  age: number | null;
  weight: number | null;
  height: number | null;
  activity: number | null;
  goal: string | null;
  macro_goals: MacroGoals | null;
};

export function parseMember(data: unknown): Member | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.id !== "number" || typeof row.name !== "string") return null;
  if (typeof row.is_primary !== "boolean") return null;

  let macroGoals: MacroGoals | null = null;
  if (row.macro_goals !== null && row.macro_goals !== undefined) {
    if (typeof row.macro_goals !== "object") return null;
    const mg = row.macro_goals as Record<string, unknown>;
    if (
      typeof mg.kcal !== "number" ||
      typeof mg.protein !== "number" ||
      typeof mg.fat !== "number" ||
      typeof mg.carbs !== "number"
    ) {
      return null;
    }
    macroGoals = {
      kcal: mg.kcal,
      protein: mg.protein,
      fat: mg.fat,
      carbs: mg.carbs,
      goalLabel: typeof mg.goalLabel === "string" ? mg.goalLabel : null,
    };
  }

  return {
    id: row.id,
    name: row.name,
    is_primary: row.is_primary,
    gender: typeof row.gender === "string" ? row.gender : null,
    age: typeof row.age === "number" ? row.age : null,
    weight: typeof row.weight === "number" ? row.weight : null,
    height: typeof row.height === "number" ? row.height : null,
    activity: typeof row.activity === "number" ? row.activity : null,
    goal: typeof row.goal === "string" ? row.goal : null,
    macro_goals: macroGoals,
  };
}

export function parseMemberList(data: unknown): Member[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => parseMember(item))
    .filter((item): item is Member => item !== null);
}
