// Imported images resolve to a bundled URL (Remotion webpack asset rule).
declare module '*.png' {
  const src: string;
  export default src;
}
