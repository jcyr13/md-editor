export type Text = string

declare module 'claude-code' {
  interface PluginState {
    'md-editor': { path: Text; draft: Text; saved: Text; status: Text; changed: boolean }
  }
}
