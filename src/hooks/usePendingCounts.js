import { useCallback, useEffect, useState } from "react";
import { fetchPendingCounts } from "../services/pendingCountsService";

const REFRESH_INTERVAL_MS = 30000;

export const usePendingCounts = (userFirmName, refreshKey) => {
  const [counts, setCounts] = useState({});

  const fetchCounts = useCallback(
    () => fetchPendingCounts(userFirmName),
    [userFirmName]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const nextCounts = await fetchCounts();
        if (active) setCounts(nextCounts);
      } catch (error) {
        if (active) console.error("Failed to load sidebar pending counts:", error);
      }
    };

    load();
    const intervalId = window.setInterval(load, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", load);
    window.addEventListener("repair-data-updated", load);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", load);
      window.removeEventListener("repair-data-updated", load);
    };
  }, [fetchCounts, refreshKey]);

  return counts;
};
