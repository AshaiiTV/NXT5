// The private workspace shell. Started early (app URL at boot, login submit)
// so its download overlaps the session check instead of following it.
export const preloadPrivateApp = () => import("../AppContent.jsx");
