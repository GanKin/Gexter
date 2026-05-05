import type {
  AgentConfig,
  ApprovalDecision,
  DoneEvent,
  ToolApprovalEvent,
  ToolDeniedEvent,
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

export type WebSessionStatus = 'idle' | 'running' | 'complete' | 'aborted' | 'error';

export type WebRuntimeSession = {
  id: string;
  model: string;
  modelProvider: string;
  apiKey?: string;
  baseUrl?: string;
  createdAt: string;
  history: InMemoryChatHistory;
  approvedTools: Set<string>;
  pendingApproval:
    | {
        resolve: (decision: ApprovalDecision) => void;
        requestId: string;
        tool: string;
        args: Record<string, unknown>;
      }
    | null;
  abortController?: AbortController;
  status: WebSessionStatus;
};

export type WebRuntimeEvent = {
  sessionId: string;
  event: AgentEvent;
};

export type WebRuntimeAgentConfig = {
  model?: string;
  modelProvider?: string;
  apiKey?: string;
  baseUrl?: string;
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
  | ToolApprovalEvent
  | ToolDeniedEvent
  | DoneEvent;

export const STREAMABLE_EVENT_TYPES = new Set<StreamableAgentEvent['type']>([
  'thinking',
  'stream_progress',
  'tool_start',
  'tool_end',
  'tool_error',
  'tool_approval',
  'tool_denied',
  'done',
]);
