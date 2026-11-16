// Type description for the Ghostscript WASM loader used by workers/gs-convert.worker.ts (EPS/AI previews).
// The package ships no types of its own.
declare module '@jspawn/ghostscript-wasm/gs.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initGS: (options?: Record<string, unknown>) => Promise<any>;
  export default initGS;
}
