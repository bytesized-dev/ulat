// Runs once when the hub's server starts. A family photo still waiting to be
// read when the hub last stopped is queued again, so its report does not stay
// "Reading the photo" forever. Not awaited, so the server takes requests while
// the model works, and never during the production build.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { resumePendingReportDrafts } = await import("./lib/ai/draft-report");
    const resumed = resumePendingReportDrafts();
    if (resumed > 0) console.log(`Reading ${resumed} family photo${resumed === 1 ? "" : "s"} left from before the restart.`);
  } catch (error) {
    // A missing or outdated database must not stop the server from starting.
    console.error("Could not resume family photo readings", error);
  }
}
