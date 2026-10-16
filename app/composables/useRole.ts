import type { Role } from "#shared/model";

/** Demo role switcher instead of real sign-in: patient, physiotherapist or doctor. */
export function useRole() {
  const role = useState<Role>("role", () => "patient");
  onMounted(() => {
    try {
      const saved = localStorage.getItem("langkah-role") as Role | null;
      if (saved && ["patient", "physio", "doctor"].includes(saved)) role.value = saved;
    } catch {}
  });
  watch(role, (r) => {
    try {
      localStorage.setItem("langkah-role", r);
    } catch {}
  });
  return role;
}

/** The demo clock, shared by the header and pages. */
export function useDemoClock() {
  const now = useState<number | null>("demo-now", () => null);
  const day = useState<number>("demo-day", () => 0);
  return { now, day };
}
