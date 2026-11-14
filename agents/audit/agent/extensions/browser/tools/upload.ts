import { disableTool } from "eve/tools";

// Audits only look at pages. They never upload files into the app under audit.
export default disableTool();
