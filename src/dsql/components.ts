import type { ComponentRegistry, ComponentDefinition } from '../types.js';

export class DSQLComponentQuery {
  readonly #registry: ComponentRegistry;

  constructor(registry: ComponentRegistry) {
    this.#registry = registry;
  }

  all(): Promise<ComponentDefinition[]> {
    return Promise.resolve([...this.#registry.components.values()]);
  }

  byName(name: string): Promise<ComponentDefinition | null> {
    return Promise.resolve(this.#registry.components.get(name) ?? null);
  }

  byPackage(packageName: string): Promise<ComponentDefinition[]> {
    return Promise.resolve(
      [...this.#registry.components.values()].filter((c) => c.package === packageName),
    );
  }

  deprecated(): Promise<ComponentDefinition[]> {
    return Promise.resolve(
      [...this.#registry.components.values()].filter((c) => c.deprecated === true),
    );
  }

  replacements(): Promise<Map<string, ComponentDefinition>> {
    const map = new Map<string, ComponentDefinition>();
    for (const component of this.#registry.components.values()) {
      if (component.replacedBy) {
        const replacement = this.#registry.components.get(component.replacedBy);
        if (replacement) map.set(component.name, replacement);
      }
    }
    return Promise.resolve(map);
  }
}
