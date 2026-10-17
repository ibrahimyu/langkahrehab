import { logActivity } from "#shared/activity";

// FIS-06 "Check now": the physio runs the progression rules for one patient outside the daily cycle.
// Makes a pending proposal only when every rule passes; the result lists each rule either way.
export default defineEventHandler(async (event) => {
  const { ws, id, now, iso } = await patientContext(event);
  assertCan(actorFrom(event), "proposal.decide");
  let made: ReturnType<typeof proposeIfReady> | null = null;
  const p = await updatePatient(ws, id, (q) => {
    made = proposeIfReady(q, now, null);
    if (!made.proposalId) logActivity(q, { at: iso, actor: "human", who: "physio", action: "act_proposal_checked", params: { passed: made.result.eligibility.filter((e) => e.passed).length, total: made.result.eligibility.length }, refs: [] });
  });
  const { result, proposalId } = made!;
  if (proposalId) await explainProposal(event, ws, id, proposalId, result, null);
  const fresh = proposalId ? ((await getPatient(ws, id)) ?? p) : p;
  return { result, proposal: fresh.proposals.find((x) => x.id === proposalId) ?? null, proposals: fresh.proposals, activity: fresh.activity, alerts: fresh.alerts };
});
