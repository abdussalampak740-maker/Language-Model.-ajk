
export interface DialectRule {
  id: string;
  rule: string;
}

const STORAGE_KEY = 'pahari_learned_rules';

export const getLearnedRules = (): DialectRule[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
};

export const addLearnedRule = (rule: string) => {
  const rules = getLearnedRules();
  const newRule = { id: Date.now().toString(), rule };
  const updated = [...rules, newRule];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const clearLearnedRules = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const rulesToPrompt = (rules: DialectRule[]): string => {
  if (rules.length === 0) return "";
  return "\nLearned Community Rules:\n" + rules.map((r, i) => `${i + 1}. ${r.rule}`).join("\n");
};
