import { homeFor } from "#shared/accounts";

// Account screens need a signed-in account; the landing page and sign-in do not.
// Each account only opens its own screens: a patient sees their own app, the care team sees /care.
export default defineNuxtRouteMiddleware((to) => {
  const area = to.path.match(/^\/(patient|care|family)(?:\/([^/]+))?/);
  if (!area) return;
  const { account } = useSession();
  const a = account.value;
  if (!a) return navigateTo({ path: "/signin", query: { next: to.fullPath } });

  const [, section, id] = area;
  if (a.role === "patient" && (section !== "patient" || id !== a.patientId)) return navigateTo(homeFor(a));
  if (a.role === "family" && (section !== "family" || id !== a.patientId)) return navigateTo(homeFor(a));
  if ((a.role === "physio" || a.role === "doctor") && section !== "care") return navigateTo("/care");
});
