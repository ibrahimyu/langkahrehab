import type { Evidence } from "#shared/model";

// Where a piece of evidence or an activity item lives in the care record (FIS-08, DOK-03).
const TAB_FOR: Record<Evidence["kind"], string> = {
  session: "sessions",
  alert: "overview",
  diary: "body",
  skin: "body",
  memory: "memories",
  question: "notes",
  note: "notes",
  task: "family",
  plan: "plan",
  proposal: "plan",
};

/** The record tab (and anchor) that shows this object. */
export function recordLink(patientId: string, tab: string, hash = "") {
  return `/care/${patientId}${tab === "overview" ? "" : `?tab=${tab}`}${hash ? `#${hash}` : ""}`;
}

export function evidenceLink(patientId: string, e: Pick<Evidence, "kind" | "id">) {
  const tab = TAB_FOR[e.kind] ?? "overview";
  const hash = e.kind === "plan" && /^v\d+$/.test(e.id) ? `plan-${e.id}` : "";
  return recordLink(patientId, tab, hash);
}
