export const notifyPendingCountsChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("repair-data-updated"));
  }
};

