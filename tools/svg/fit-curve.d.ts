declare module 'fit-curve' {
  /** Schneider curve fitting: points → cubic Béziers as [p0, c1, c2, p1]. */
  const fitCurve: (points: number[][], maxError: number) => number[][][];
  export default fitCurve;
}
