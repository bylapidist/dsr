import type { RuleRegistry, RuleDefinition } from '../types.js';

export class DSQLRuleQuery {
  readonly #registry: RuleRegistry;
  readonly #category: string | undefined;

  constructor(registry: RuleRegistry, category?: string) {
    this.#registry = registry;
    this.#category = category;
  }

  #rules(): RuleDefinition[] {
    const all = [...this.#registry.rules.values()];
    if (this.#category !== undefined) {
      return all.filter((r) => r.category === this.#category);
    }
    return all;
  }

  all(): Promise<RuleDefinition[]> {
    return Promise.resolve(this.#rules());
  }

  enabled(): Promise<RuleDefinition[]> {
    return Promise.resolve(this.#rules().filter((r) => r.enabled));
  }

  byId(ruleId: string): Promise<RuleDefinition | null> {
    return Promise.resolve(this.#registry.rules.get(ruleId) ?? null);
  }

  categories(): Promise<string[]> {
    const cats = new Set(this.#rules().map((r) => r.category));
    return Promise.resolve([...cats].sort());
  }

  fixable(): Promise<RuleDefinition[]> {
    return Promise.resolve(this.#rules().filter((r) => r.fixable && r.enabled));
  }
}
