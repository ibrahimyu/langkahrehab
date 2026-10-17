import { str } from "#shared/model";
import { familyView } from "#shared/family";

// A family member changes the words of a family question that has not been answered yet.
export default defineEventHandler(async (event) => {
  const { ws, id, now } = await patientContext(event);
  assertCan(actorFrom(event), "familyQuestion.add");
  const noteId = getRouterParam(event, "noteId");
  const text = str(((await readBody(event)) ?? {}).text, 300);
  if (!text) throw bad("Write your question.");
  const p = await updatePatient(ws, id, (p) => {
    const n = p.notes.find((x) => x.id === noteId && x.source === "family" && x.kind === "question");
    if (!n) throw createError({ statusCode: 404, statusMessage: "Question not found." });
    if (n.reply || n.answeredAt) throw bad("This question has been answered.");
    n.quote = text;
    n.summary = n.summary.replace(/:.*$/s, `: ${text}`).slice(0, 160);
  });
  return familyView(p, now);
});
