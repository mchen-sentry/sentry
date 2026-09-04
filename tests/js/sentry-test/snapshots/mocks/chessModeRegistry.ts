// Stub for sentry/chessMode/registry in snapshot tests.
// require.context is webpack-only and unavailable in the Node SSR environment.
export const CHESS_MODE_ENABLED = false;
export function chessFetch(): never {
  throw new Error('chessFetch is not available in snapshot tests');
}
export function chessResponse(): never {
  throw new Error('chessResponse is not available in snapshot tests');
}
