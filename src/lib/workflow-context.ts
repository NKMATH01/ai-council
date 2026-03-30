import { Dispatch, MutableRefObject } from "react";
import { DebateState, DebateRoleId } from "./types";
import { DebateAction } from "./debate-actions";

export interface WorkflowContext {
  dispatch: Dispatch<DebateAction>;
  stateRef: MutableRefObject<DebateState>;
  abortRef: MutableRefObject<AbortController | null>;
  setStreamText: (text: string) => void;
  setStreamRoleId: (roleId: DebateRoleId | null) => void;
  setStreamLabel: (label: string) => void;
  fetchStream: (url: string, body: Record<string, unknown>, onChunk: (text: string) => void) => Promise<string>;
  save: (snap: DebateState, st?: string) => Promise<void>;
}
