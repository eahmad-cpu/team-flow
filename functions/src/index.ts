import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "me-central2" });

export { registerDeviceInstallation, unregisterDeviceInstallation } from "./devices.js";
export {
  createAdminTeam,
  createAdminUser,
  getAdminDirectory,
  setAdminMembership,
  setAdminMembershipActive,
  setAdminUserPassword,
  transferAdminMembership,
  updateAdminTeam,
  updateAdminUser,
} from "./admin/index.js";
export { carryOverUnfinishedTasks } from "./tasks/carry-over.js";
export { notifyTaskCreated, notifyTaskUpdated } from "./notifications/tasks.js";
export {
  notifyRoadmapGoalCreated,
  notifyRoadmapGoalUpdated,
} from "./notifications/roadmap.js";
