import type { Scenario } from "#shared/scenarios";

/** Starts a guided scenario from the prepared case, however it was left last time. */
export function useScenarioStart() {
  const api = useApi();
  const busy = useState("scenario-busy", () => "");
  async function start(s: Scenario) {
    busy.value = s.id;
    try {
      await api(`/api/patients/${s.patientId}/reset`, { method: "POST" });
      useDataVersion().value++;
    } finally {
      busy.value = "";
    }
    await navigateTo(`/s/${s.id}`);
  }
  return { start, busy };
}
