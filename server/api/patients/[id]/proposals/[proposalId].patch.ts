import { logActivity } from "#shared/activity";
import { pick, REJECT_REASONS, str, type Plan, type ProposalChange } from "#shared/model";
import { PROG } from "#shared/progression";
import { resolveProposalAlerts } from "#shared/daily";

// FIS-06: the physio decides. Approve (as proposed, or after editing the numbers) saves a new plan
// version with source "proposal"; reject needs a reason; reopen undoes a reject while the plan is unchanged.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  assertCan(actorFrom(event), "proposal.decide");
  const proposalId = getRouterParam(event, "proposalId") ?? "";
  const b = (await readBody(event)) ?? {};
  const decision = pick(b.decision, ["approve", "reject", "reopen"] as const, "approve");

  const p = await updatePatient(ws, id, (p) => {
    const x = p.proposals.find((y) => y.id === proposalId);
    if (!x) throw createError({ statusCode: 404, statusMessage: "Proposal not found." });
    const ref = { kind: "proposal" as const, id: x.id, label: `Proposal for plan v${x.basedOnPlanVersion}` };
    const closeAlert = () => {
      resolveProposalAlerts(p, iso, actorFrom(event).role === "doctor" ? "doctor" : "physio");
    };

    if (decision === "reopen") {
      if (x.status !== "rejected" || x.basedOnPlanVersion !== p.plan.version || p.proposals.some((y) => y.status === "pending")) throw bad("This proposal can no longer be reopened.");
      Object.assign(x, { status: "pending", decidedAt: null, decidedBy: null, rejectReason: null, rejectNote: "" });
      logActivity(p, { at: iso, actor: "human", who: "physio", action: "act_proposal_reopened", refs: [ref] });
      return;
    }
    if (x.status !== "pending") throw bad("This proposal was already decided.");
    if (x.basedOnPlanVersion !== p.plan.version) {
      x.status = "expired";
      x.decidedAt = iso;
      closeAlert();
      throw createError({ statusCode: 409, statusMessage: "The plan changed since this proposal was made." });
    }

    if (decision === "reject") {
      const reason = REJECT_REASONS.includes(b.rejectReason) ? b.rejectReason : null;
      if (!reason) throw bad("Choose why you are not approving.");
      Object.assign(x, { status: "rejected", decidedAt: iso, decidedBy: "physio", rejectReason: reason, rejectNote: str(b.note, 200) });
      closeAlert();
      logActivity(p, { at: iso, actor: "human", who: "physio", action: "act_proposal_rejected", params: { reason }, quote: str(b.note, 200) || null, refs: [ref] });
      return;
    }

    // Approve, with the physio's numbers when edited. Only the exercises in the proposal, within the doctor's limits.
    const maxSets = p.plan.maxSets ?? PROG.defaultMaxSets;
    const maxReps = p.plan.maxReps ?? PROG.defaultMaxReps;
    let changes: ProposalChange[] = x.changes;
    if (Array.isArray(b.changes)) {
      changes = x.changes.map((c) => {
        const edit = b.changes.find((e: any) => e?.exerciseId === c.exerciseId && e?.field === c.field);
        const to = edit ? Math.round(Number(edit.to)) : c.to;
        const max = c.field === "reps" ? maxReps : maxSets;
        if (!Number.isFinite(to) || to < 1) throw bad("Enter a number of 1 or more.");
        if (to > max) throw bad(`Above the doctor's limit: at most ${max} ${c.field}.`);
        return { ...c, to };
      });
    }
    const items = p.plan.items.map((i) => {
      const next = { ...i };
      for (const c of changes) if (c.exerciseId === i.exerciseId) next[c.field] = c.to;
      return next;
    });
    const plan: Plan = { ...p.plan, version: p.plan.version + 1, items, source: "proposal", updatedAt: iso, updatedBy: "physio" };
    p.planHistory = [...p.planHistory, p.plan].slice(-20);
    p.plan = plan;
    const edited = changes.some((c, i) => c.to !== x.changes[i]!.to);
    Object.assign(x, { status: "approved", decidedAt: iso, decidedBy: "physio", resultPlanVersion: plan.version, changes });
    closeAlert();
    logActivity(p, { at: iso, actor: "human", who: "physio", action: edited ? "act_proposal_edited" : "act_proposal_approved", params: { v: plan.version }, refs: [ref, { kind: "plan", id: `v${plan.version}`, label: `Plan v${plan.version}` }] });
  });
  return { proposals: p.proposals, plan: p.plan, planHistory: p.planHistory, alerts: p.alerts, activity: p.activity };
});
