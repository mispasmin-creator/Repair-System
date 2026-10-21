import React from "react";
import { TableHead, TableCell } from "./Table";
import { formatDateOnly } from "../../utils/dateUtils";

/**
 * Har page ke table me sabse last ke do column: Planned Date aur Actual Date.
 *  - ui/Table wale tables me:  <PlannedActualHeads />   aur  <PlannedActualCells planned={..} actual={..} />
 *  - seedhe <table><th>/<td> wale tables me `raw` prop lagao.
 */
export const PlannedActualHeads = ({ raw = false }) =>
  raw ? (
    <>
      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Planned Date</th>
      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Actual Date</th>
    </>
  ) : (
    <>
      <TableHead className="min-w-[120px]">Planned Date</TableHead>
      <TableHead className="min-w-[120px]">Actual Date</TableHead>
    </>
  );

export const PlannedActualCells = ({ planned, actual, raw = false }) =>
  raw ? (
    <>
      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{formatDateOnly(planned)}</td>
      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{formatDateOnly(actual)}</td>
    </>
  ) : (
    <>
      <TableCell>{formatDateOnly(planned)}</TableCell>
      <TableCell>{formatDateOnly(actual)}</TableCell>
    </>
  );
