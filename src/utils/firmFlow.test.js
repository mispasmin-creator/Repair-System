import test from "node:test";
import assert from "node:assert/strict";

import {
  hasCompletedManagementApproval,
  hasCompletedSentToVendor,
  usesDirectStoreInFlow,
} from "./firmFlow.js";

test("PMMPL and Refrasynth use the direct Store In flow", () => {
  assert.equal(usesDirectStoreInFlow("PMMPL"), true);
  assert.equal(usesDirectStoreInFlow(" refrasynth "), true);
  assert.equal(usesDirectStoreInFlow("Other Firm"), false);
});

test("a downstream stage moves a task out of Sent to Vendor pending", () => {
  assert.equal(
    hasCompletedSentToVendor({
      "Actual 1": "",
      "Management Approval Date": "23/10/2026",
    }),
    true
  );
  assert.equal(
    hasCompletedSentToVendor({ "Planned 1": "12/10/2026", "Actual 1": "" }),
    false
  );
});

test("a downstream stage moves a task into Management Approval history", () => {
  assert.equal(
    hasCompletedManagementApproval({
      "Management Approval Date": "",
      "Actual 2": "23/10/2026",
    }),
    true
  );
  assert.equal(hasCompletedManagementApproval({ "Actual 1": "23/10/2026" }), false);
});
