import { installNbaDailyAssertionHelper } from "./helper";

const api = new URL(import.meta.env.VITE_API_URL);
if (api.pathname !== "/" || api.search || api.hash) throw Error("Invalid assertion API origin");
installNbaDailyAssertionHelper({ window, apiOrigin: api.origin, allowLocalTesting: import.meta.env.DEV });
