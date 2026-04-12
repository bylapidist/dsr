import type { KernelState, TokenType, EntropyScore } from '../types.js';
import { DSQLTokenQuery } from './tokens.js';
import { DSQLRuleQuery } from './rules.js';
import { DSQLComponentQuery } from './components.js';

/**
 * Executes DSQL queries against a KernelState snapshot.
 * Runs in-process inside the kernel; no serialisation overhead.
 */
export class DSQLExecutor {
  readonly #state: KernelState;

  constructor(state: KernelState) {
    this.#state = state;
  }

  tokens(type?: TokenType): DSQLTokenQuery {
    return new DSQLTokenQuery(this.#state.tokenGraph, this.#state.deprecationLedger, type);
  }

  rules(category?: string): DSQLRuleQuery {
    return new DSQLRuleQuery(this.#state.ruleRegistry, category);
  }

  components(): DSQLComponentQuery {
    return new DSQLComponentQuery(this.#state.componentRegistry);
  }

  entropy(): EntropyScore {
    return this.#state.entropyState.current;
  }
}
