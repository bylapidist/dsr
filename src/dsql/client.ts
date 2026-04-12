import type {
  TransportClient,
  KWPFrame,
  DtifFlattenedToken,
  TokenType,
  RankedToken,
  DeprecatedToken,
  RuleDefinition,
  ComponentDefinition,
  EntropyScore,
} from '../types.js';
import {
  isRankedTokenArray,
  isDtifFlattenedTokenArray,
  isDtifFlattenedTokenOrNull,
  isDeprecatedTokenArray,
  isStringOrNull,
  isRuleDefinitionArray,
  isRuleDefinitionOrNull,
  isStringArray,
  isComponentDefinitionArray,
  isComponentDefinitionOrNull,
  isEntropyScore,
} from '../guards.js';

/**
 * Remote DSQL client. Dispatches queries over a transport to the kernel process.
 * Method signatures match DSQLExecutor so consumers can swap between local
 * (in-kernel) and remote (client-side) execution without code changes.
 */
export class DSQLClient {
  readonly #transport: TransportClient;

  constructor(transport: TransportClient) {
    this.#transport = transport;
  }

  tokens(type?: TokenType): RemoteDSQLTokenQuery {
    return new RemoteDSQLTokenQuery(this.#transport, type);
  }

  rules(category?: string): RemoteDSQLRuleQuery {
    return new RemoteDSQLRuleQuery(this.#transport, category);
  }

  components(): RemoteDSQLComponentQuery {
    return new RemoteDSQLComponentQuery(this.#transport);
  }

  async entropy(): Promise<EntropyScore> {
    const frame = await typedRequest(this.#transport, 'dsql.entropy', {}, isEntropyScore);
    return frame;
  }
}

// ---------------------------------------------------------------------------
// Remote query implementations
// ---------------------------------------------------------------------------

class RemoteDSQLTokenQuery {
  readonly #transport: TransportClient;
  readonly #type: TokenType | undefined;

  constructor(transport: TransportClient, type?: TokenType) {
    this.#transport = transport;
    this.#type = type;
  }

  closest(rawValue: string, property: string): Promise<RankedToken[]> {
    return typedRequest(
      this.#transport,
      'dsql.tokens.closest',
      {
        rawValue,
        property,
        type: this.#type,
      },
      isRankedTokenArray,
    );
  }

  forProperty(cssProperty: string): Promise<DtifFlattenedToken[]> {
    return typedRequest(
      this.#transport,
      'dsql.tokens.forProperty',
      {
        cssProperty,
        type: this.#type,
      },
      isDtifFlattenedTokenArray,
    );
  }

  byPointer(pointer: string): Promise<DtifFlattenedToken | null> {
    return typedRequest(
      this.#transport,
      'dsql.tokens.byPointer',
      { pointer },
      isDtifFlattenedTokenOrNull,
    );
  }

  deprecated(): Promise<DeprecatedToken[]> {
    return typedRequest(
      this.#transport,
      'dsql.tokens.deprecated',
      {
        type: this.#type,
      },
      isDeprecatedTokenArray,
    );
  }

  withReplacement(pointer: string): Promise<string | null> {
    return typedRequest(
      this.#transport,
      'dsql.tokens.withReplacement',
      { pointer },
      isStringOrNull,
    );
  }

  all(): Promise<DtifFlattenedToken[]> {
    return typedRequest(
      this.#transport,
      'dsql.tokens.all',
      { type: this.#type },
      isDtifFlattenedTokenArray,
    );
  }
}

class RemoteDSQLRuleQuery {
  readonly #transport: TransportClient;
  readonly #category: string | undefined;

  constructor(transport: TransportClient, category?: string) {
    this.#transport = transport;
    this.#category = category;
  }

  all(): Promise<RuleDefinition[]> {
    return typedRequest(
      this.#transport,
      'dsql.rules.all',
      {
        category: this.#category,
      },
      isRuleDefinitionArray,
    );
  }

  enabled(): Promise<RuleDefinition[]> {
    return typedRequest(
      this.#transport,
      'dsql.rules.enabled',
      {
        category: this.#category,
      },
      isRuleDefinitionArray,
    );
  }

  byId(ruleId: string): Promise<RuleDefinition | null> {
    return typedRequest(this.#transport, 'dsql.rules.byId', { ruleId }, isRuleDefinitionOrNull);
  }

  categories(): Promise<string[]> {
    return typedRequest(this.#transport, 'dsql.rules.categories', {}, isStringArray);
  }

  fixable(): Promise<RuleDefinition[]> {
    return typedRequest(
      this.#transport,
      'dsql.rules.fixable',
      {
        category: this.#category,
      },
      isRuleDefinitionArray,
    );
  }
}

class RemoteDSQLComponentQuery {
  readonly #transport: TransportClient;

  constructor(transport: TransportClient) {
    this.#transport = transport;
  }

  all(): Promise<ComponentDefinition[]> {
    return typedRequest(this.#transport, 'dsql.components.all', {}, isComponentDefinitionArray);
  }

  byName(name: string): Promise<ComponentDefinition | null> {
    return typedRequest(
      this.#transport,
      'dsql.components.byName',
      { name },
      isComponentDefinitionOrNull,
    );
  }

  byPackage(packageName: string): Promise<ComponentDefinition[]> {
    return typedRequest(
      this.#transport,
      'dsql.components.byPackage',
      { packageName },
      isComponentDefinitionArray,
    );
  }

  deprecated(): Promise<ComponentDefinition[]> {
    return typedRequest(
      this.#transport,
      'dsql.components.deprecated',
      {},
      isComponentDefinitionArray,
    );
  }
}

// ---------------------------------------------------------------------------
// Typed request helper
// ---------------------------------------------------------------------------

async function typedRequest<T>(
  transport: TransportClient,
  method: string,
  params: Record<string, unknown>,
  guard: (v: unknown) => v is T,
): Promise<T> {
  const frame: KWPFrame = await transport.request({
    type: 'request',
    id: crypto.randomUUID(),
    method,
    payload: params,
  });

  if (!guard(frame.payload)) {
    throw new Error(
      `Kernel returned unexpected payload shape for "${method}": ${JSON.stringify(frame.payload)}`,
    );
  }

  return frame.payload;
}
