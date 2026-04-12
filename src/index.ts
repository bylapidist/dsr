export type {
  KernelState,
  KernelEvent,
  KernelStatus,
  KernelStatusReport,
  KWPFrame,
  KWPFrameType,
  KWPError,
  KernelTransport,
  TransportClient,
  KWPFrameHandler,
  ResolvedDtifGraph,
  RuleRegistry,
  RuleDefinition,
  RuleSeverity,
  ComponentRegistry,
  ComponentDefinition,
  DeprecationLedger,
  DeprecationEntry,
  PluginManifest,
  AgentRegistry,
  AgentEntry,
  AgentStats,
  EntropyScore,
  EntropyScoreComponents,
  EntropyState,
  RankedToken,
  DeprecatedToken,
  DistanceMetric,
  DtifFlattenedToken,
  TokenType,
} from './types.js';

export { KernelProcess, getRunningKernelPid } from './kernel/index.js';
export { KernelEventBus } from './kernel/event-bus.js';
export {
  createInitialState,
  withTokenGraph,
  withSnapshotHash,
  withEntropyState,
} from './kernel/state.js';
export { writeSnapshot, readSnapshot } from './kernel/snapshot.js';

export {
  UnixSocketTransport,
  UnixSocketClient,
  DEFAULT_SOCKET_PATH,
} from './transport/unix-socket.js';
export { HttpTransport, HttpClient, DEFAULT_HTTP_PORT } from './transport/http.js';

export { DSQLExecutor } from './dsql/executor.js';
export { DSQLClient } from './dsql/client.js';
export { DSQLTokenQuery } from './dsql/tokens.js';
export { DSQLRuleQuery } from './dsql/rules.js';
export { DSQLComponentQuery } from './dsql/components.js';

export { NodeEnvironment } from './environments/node.js';
export { BrowserEnvironment } from './environments/browser.js';
export { EdgeEnvironment } from './environments/edge.js';

export { KernelWriteAPI } from './write-api/index.js';
