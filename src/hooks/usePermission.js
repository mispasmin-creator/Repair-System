import { useAuth } from "../context/AuthContext";
import { getPermissionLevel, hasPermission } from "../utils/permissions";

export const usePermission = (resource) => {
  const { user } = useAuth();
  return {
    level: getPermissionLevel(user, resource),
    canRead: hasPermission(user, resource, "read"),
    canWrite: hasPermission(user, resource, "write"),
  };
};
