/** Decide how to handle a stroke when another gesture interrupts the active one. */
export function interruptedStrokeAction(
  tool: string,
  drawing: boolean,
  awaitingCommit: boolean,
  blocked: boolean,
  pointCount: number,
): 'commit' | 'preserve' | 'discard' {
  'worklet';
  if (!blocked && drawing && (tool === 'pen' || tool === 'highlighter') && pointCount > 0) {
    return 'commit';
  }
  if (awaitingCommit) return 'preserve';
  return 'discard';
}

export const isCurrentStrokeCommit=(currentGeneration:number,commitGeneration:number)=>currentGeneration===commitGeneration;
