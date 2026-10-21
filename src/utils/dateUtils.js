/**
 * Tables me Planned / Actual date dikhane ke liye.
 * Input kuch bhi ho sakta hai: "13/10/2026 15:42:00" (app ka format), ISO string, ya Date.
 * Output: "13/10/2026" (IST), khali / galat ho to "-".
 */
export const formatDateOnly = (v) => {
  if (!v) return "-";
  const s = String(v).trim();
  if (!s || s === "-") return "-";

  // dd/mm/yyyy [hh:mm[:ss]]  -> date wahi rehti hai, timezone ka jhanjhat nahi
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;

  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
};
