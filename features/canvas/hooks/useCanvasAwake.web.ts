// Browsers require an activated user gesture for wake locks. Avoid requesting
// one on mount and avoid deactivating a lock that was never activated.
export function useCanvasAwake():void{}
