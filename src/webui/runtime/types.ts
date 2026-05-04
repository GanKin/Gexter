import type {
  AgentConfig,
  DoneEvent,
  StreamProgressEvent,
  ThinkingEvent,
  ToolEndEvent,
  ToolErrorEvent,
  ToolStartEvent,
  AgentEvent,
} from '../../agent/types';
import type { InMemoryChatHistory } from '../../utils/in-memory-chat-history';

export type RuntimeHealth = {
  ok: boolean;
  runtime: 'dexter';
  mode: 'webui';
  model: string;
  gatewayCompatible: true;
};

export type WebSessionStatus = 'idle' | 'running' | 'complete' | 'error';

export type WebRuntimeSession = {
  id: string;
  model: string;
  createdAt: string;
  history: InMemoryChatHistory;
  approvedTools: Set<string>;
  status: WebSessionStatus;
};

export type WebRuntimeEvent = {
  sessionId: string;
  event: AgentEvent;
};

export type WebRuntimeAgentConfig = {
  model?: string;
  modelProvider?: string;
  maxIterations?: number;
  signal?: AbortSignal;
  requestToolApproval?: AgentConfig['requestToolApproval'];
  sessionApprovedTools?: Set<string>;
  memoryEnabled?: boolean;
  messageQueue?: AgentConfig['messageQueue'];
};

export type RunWebSessionOptions = {
  query: string;
  config?: WebRuntimeAgentConfig;
  onEvent?: (event: WebRuntimeEvent) => void | Promise<void>;
};

export type StreamableAgentEvent =
  | ThinkingEvent
  | StreamProgressEvent
  | ToolStartEvent
  | ToolEndEvent
  | ToolErrorEvent
  | DoneEvent;

export const PHASE2_EVENT_TYPES = new Set<StreamableAgentEvent['type']>([
  'thinking',
  'stream_progress',
  'tool_start',
  'tool_end',
  'tool_error',
  'done',
]);
