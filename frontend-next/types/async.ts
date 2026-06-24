/** Discriminated union for client-side fetch / mutation UI state. */
export type AsyncState<T, E = string> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "error"; error: E };

/** Fetch lifecycle without an idle state (typical useEffect on mount). */
export type FetchState<T, E = string> =
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "error"; error: E };

export function isAsyncOk<T, E>(
  state: AsyncState<T, E>,
): state is { kind: "ok"; data: T } {
  return state.kind === "ok";
}

export function isFetchOk<T, E>(
  state: FetchState<T, E>,
): state is { kind: "ok"; data: T } {
  return state.kind === "ok";
}
