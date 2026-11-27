/**
 * Real timestamps (observability-evals ticket 04, QUA-08). A Workflow script
 * cannot read the clock (ticket 02), so the dispatch entry point stamps these
 * placeholders, and the agent that writes the trace lines (the scribe, or the
 * worker in `single`) replaces them with the clock's UTC time before appending.
 * The start is the time the orchestrator wrote the launch's args file
 * (<scratch>/args/<id>.json, written just before the launch); the end is the
 * time of the write.
 */
export const START_PLACEHOLDER = "{{START_UTC}}";
export const END_PLACEHOLDER = "{{END_UTC}}";

const FORMAT = "+%Y-%m-%dT%H:%M:%SZ";

export function argsFileOf(scratch: string, id: string): string {
  return `${scratch.replace(/\/+$/, "") || "."}/args/${id.replace(/[^A-Za-z0-9_.-]/g, "_")}.json`;
}

/** True when any line carries a placeholder the writer must replace. */
export function hasPlaceholder(lines: string[]): boolean {
  return lines.some((l) => l.includes(START_PLACEHOLDER) || l.includes(END_PLACEHOLDER));
}

/** How the writer replaces the placeholders, for the scribe prompt and the worker's trace step. */
export function clockSteps(argsFile: string): string[] {
  return [
    `Before appending, replace the time placeholders from the clock, in UTC. Change nothing else in the lines:`,
    `- each ${END_PLACEHOLDER} with the time now: \`date -u ${FORMAT}\``,
    `- each ${START_PLACEHOLDER} with the time the launch's args file was written: \`date -u -r ${argsFile} ${FORMAT}\` (GNU date), or on BSD/macOS, where -r takes epoch seconds, \`date -u -r "$(stat -f %m ${argsFile})" ${FORMAT}\`. If that file does not exist, use the end time for the start. If neither command works, use the end time for the start.`,
  ];
}
