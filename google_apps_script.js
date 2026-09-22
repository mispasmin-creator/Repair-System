function doGet(e) {
  try {
    // Handle login requests
    if (e.parameter.action === 'login') {
      var username = e.parameter.username;
      var password = e.parameter.password;
      var callback = e.parameter.callback;

      var loginResult = handleLogin(username, password);

      // Handle JSONP callback if provided
      if (callback) {
        var jsonpResponse = callback + '(' + JSON.stringify(loginResult) + ');';
        return ContentService.createTextOutput(jsonpResponse)
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }

      // Regular JSON response
      var response = ContentService.createTextOutput(JSON.stringify(loginResult))
        .setMimeType(ContentService.MimeType.JSON);
      return setCorsHeaders(response);
    }

    // Handle Accounts sheet data (row 6 is header row)
    if (e.parameter.action === 'getAccountsData') {
      try {
        var sheetId = e.parameter.sheetId;
        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName('Accounts');
        if (!sheet) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Accounts sheet not found' }))
            .setMimeType(ContentService.MimeType.JSON);
        }

        var allData = sheet.getDataRange().getValues();
        // Row 6 (index 5) = headers, rows 7+ = data
        var headers = allData[5];
        var dataRows = allData.slice(6);

        var result = dataRows
          .filter(function(row) {
            // Skip completely empty rows
            return row.some(function(cell) { return cell !== '' && cell !== null && cell !== undefined; });
          })
          .map(function(row) {
            var obj = {};
            headers.forEach(function(header, idx) {
              if (header) {
                var val = row[idx];
                if (val instanceof Date) {
                  obj[header] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy');
                } else {
                  obj[header] = val !== null && val !== undefined ? val.toString() : '';
                }
              }
            });
            return obj;
          });

        return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Handle Repair Tasks data
    if (e.parameter.action === 'getRepairTasks') {
      try {
        var sheetId = e.parameter.sheetId;
        var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName('Repair System');
        if (!sheet) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Repair System sheet not found' }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        var allData = sheet.getDataRange().getValues();
        var headers = allData[5] || [];
        var dataRows = allData.slice(6);

        var result = dataRows
          .filter(function(row) { return row.some(function(cell) { return cell !== '' && cell !== null && cell !== undefined; }); })
          .map(function(row) {
            var obj = {};
            headers.forEach(function(header, idx) {
              if (header) {
                var val = row[idx];
                if (val instanceof Date) {
                  obj[header] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
                } else {
                  obj[header] = val !== null && val !== undefined ? val.toString() : '';
                }
              }
            });
            return obj;
          });
        return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Handle adding 31 columns for Advance Payment Workflow
    if (e.parameter.action === 'addAdvanceColumns') {
      try {
        var sheetId = e.parameter.sheetId;
        var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName('Repair FMS Advance Payment');
        if (!sheet) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Repair FMS Advance Payment sheet not found' }))
            .setMimeType(ContentService.MimeType.JSON);
        }

        var newHeaders = [
          // A. Basic & Approval Info
          "Firm Name",
          "Department",
          "Management Approval Date",
          "Management Remark",

          // B. Step 2: Posting
          "Planned Posting",
          "Actual Posting",
          "Posting Voucher No",
          "Posting Done By",

          // C. Step 3: Make Payment (Advance Release)
          "Planned Payment",
          "Actual Payment Date",
          "Advance Payment UTR / Cheque No",
          "Advance Amount Paid",
          "Payment Done By",

          // D. Step 4: Check Machine
          "Planned Check Machine",
          "Actual Check Machine Date",
          "Bill Date",
          "Bill Image Link",
          "Checked By",

          // E. Step 5: Store In
          "Planned Store In",
          "Actual Store In Date",
          "Received Quantity",
          "Store In Done By",

          // F. Step 6: Full Billing
          "Planned Full Billing",
          "Actual Full Billing Date",
          "Balance Amount To Pay",
          "Balance Payment UTR / Cheque No",
          "Billing Status",

          // G. Step 7: Accounts
          "Planned Accounts",
          "Actual Accounts Date",
          "Accounts Status",
          "Accounts Remark"
        ];

        sheet.getRange(6, 11, 1, newHeaders.length).setValues([newHeaders]);

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          count: newHeaders.length,
          message: "Successfully added " + newHeaders.length + " headers in Row 6 of Repair FMS Advance Payment starting at Column 11 (K)!"
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Handle adding Process Remark column in Repair System sheet
    if (e.parameter.action === 'addProcessRemarkColumn') {
      try {
        var sheetId = e.parameter.sheetId;
        var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName('Repair System');
        if (!sheet) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Repair System sheet not found' }))
            .setMimeType(ContentService.MimeType.JSON);
        }

        var headers = sheet.getRange(6, 1, 1, sheet.getLastColumn()).getValues()[0];
        var existingIndex = headers.indexOf('Process Remark');
        if (existingIndex !== -1) {
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: "Process Remark column already exists at column " + (existingIndex + 1)
          })).setMimeType(ContentService.MimeType.JSON);
        }

        var nextCol = sheet.getLastColumn() + 1;
        sheet.getRange(6, nextCol).setValue('Process Remark');

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Successfully added 'Process Remark' header in Row 6 at Column " + nextCol + "!"
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Handle Advance Payments sheet data (row 6 is header row)
    if (e.parameter.action === 'getAdvancePayments') {
      try {
        var sheetId = e.parameter.sheetId;
        var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName('Repair FMS Advance Payment');
        if (!sheet) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Repair FMS Advance Payment sheet not found' }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        var allData = sheet.getDataRange().getValues();
        var headers = allData[5]; // Row 6 (0-indexed as 5) = actual headers
        var dataRows = allData.slice(6); // Data starts from row 7

        var result = dataRows
          .filter(function(row) { return row.some(function(cell) { return cell !== '' && cell !== null; }); })
          .map(function(row) {
            var obj = {};
            headers.forEach(function(header, idx) {
              if (header) {
                var val = row[idx];
                if (val instanceof Date) {
                  obj[header] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
                } else {
                  obj[header] = val !== null && val !== undefined ? val.toString() : '';
                }
              }
            });
            return obj;
          });

        return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Existing sheet data retrieval logic
    var sheetName = e.parameter.sheet;
    var sheetId = e.parameter.sheetId;
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Sheet not found",
        availableSheets: ss.getSheets().map(s => s.getName())
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Get ALL data without filtering
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var rows = data.slice(1); // Skip header row

    // Build response in required format
    var response = {
      table: {
        cols: headers.map((header, i) => ({
          id: 'col' + i,
          label: header,
          type: 'string'
        })),
        rows: rows.map((row, rowIndex) => ({
          c: row.map((cell, colIndex) => ({
            v: cell,
            f: formatCellValue(cell)
          })),
          _rowNum: rowIndex + 2 // Actual sheet row number
        }))
      },
      success: true,
      rowCount: rows.length
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to format cell values
function formatCellValue(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return value !== null && value !== undefined ? value.toString() : '';
}

// Set CORS headers for all responses
function setCorsHeaders(output) {
  try {
    output.addHeader('Access-Control-Allow-Origin', '*');
    output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    output.addHeader('Access-Control-Allow-Headers', 'Content-Type');
  } catch (e) {
    // Headers may not be available in all contexts
  }
  return output;
}

// Handle OPTIONS requests for CORS preflight
function doOptions(e) {
  return setCorsHeaders(ContentService.createTextOutput(''));
}

// Function to upload a file to Google Drive
function uploadFileToDrive(base64Data, fileName, mimeType, folderId) {
  try {
    // Remove the data URL prefix if it exists
    let fileData = base64Data;
    if (base64Data.indexOf('base64,') !== -1) {
      fileData = base64Data.split('base64,')[1];
    }

    // Decode the base64 data
    const decoded = Utilities.base64Decode(fileData);

    // Create a blob from the decoded data
    const blob = Utilities.newBlob(decoded, mimeType || "image/jpeg", fileName || "image.jpg");

    // Get the folder reference
    const folder = DriveApp.getFolderById(folderId);

    // Upload the file to the folder
    const file = folder.createFile(blob);

    // Make the file accessible via link
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      console.warn("Sharing permission warning (continuing): " + shareErr.toString());
    }

    // Return the direct link to view the file
    return "https://drive.google.com/uc?export=view&id=" + file.getId();
  } catch (error) {
    console.error("Error uploading file: " + error.toString());
    return null;
  }
}

function getNextTaskNumber(sheet) {
  // Get all existing task numbers from column B (assuming Task No is in column B)
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1; // If no data except header, start with 1

  const taskNumbers = sheet.getRange(2, 2, lastRow - 1, 1).getValues()
    .flat()
    .map(taskNo => {
      const match = taskNo.toString().match(/TS-(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });

  return Math.max(...taskNumbers, 0) + 1;
}

// Main function to handle POST requests
function doPost(e) {
  try {
    var params = e.parameter;

    // Check if this is a file upload action
    if (params.action === 'uploadFile') {
      try {
        // Extract file upload parameters
        var base64Data = params.base64Data;
        var fileName = params.fileName || "image.jpg";
        var mimeType = params.mimeType || "image/jpeg";
        var folderId = params.folderId;

        // Validate required parameters
        if (!base64Data || !folderId) {
          throw new Error("Missing required parameters: base64Data or folderId");
        }

        // Upload the file to Google Drive
        var fileUrl = uploadFileToDrive(base64Data, fileName, mimeType, folderId);

        if (!fileUrl) {
          throw new Error("Google Drive could not create file. Please check Folder ID and permissions.");
        }

        // Return the file URL
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          fileUrl: fileUrl
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (uploadErr) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: uploadErr.toString(),
          message: uploadErr.message
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Existing sheet update logic
    var sheetName = params.sheetName;
    var action = params.action || 'insert';
    if (action === 'add') action = 'insert';

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error("Sheet not found: " + sheetName);
    }

    if (params.batchInsert === 'true') {
      try {
        const rows = JSON.parse(params.rowData);
        const sheet = ss.getSheetByName(sheetName);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

        const newRows = rows.map((obj) => {
          return headers.map(header =>
            header === "Task No" ? obj["Task No"] : (obj[header] || "")
          );
        });

        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);

        return ContentService.createTextOutput(
          JSON.stringify({ success: true, message: "Batch insert successful" })
        ).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: error.message })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (action === 'insert') {
      try {
        // Step 1: Extract data
        const formData = {};
        for (let key in params) {
          if (key !== 'action' && key !== 'sheetName') {
            formData[key] = params[key];
          }
        }

        // Optional: Parse maintenanceSchedule if it's a JSON string
        if (formData["Maintenance Schedule"]) {
          try {
            formData["Maintenance Schedule"] = JSON.parse(formData["Maintenance Schedule"]);
          } catch (_) { }
        }

        // Step 2: Generate Serial Number from sheet
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

        // Step 3: Construct row in header order
        const newRow = headers.map((header) => {
          const value = formData[header];
          if (Array.isArray(value)) {
            return value.join(", ");
          }
          return value || "";
        });

        // Step 4: Append the new row
        sheet.appendRow(newRow);

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Row added successfully",
          // serialNo: finalSerial,
          rowCount: sheet.getLastRow()
        })).setMimeType(ContentService.MimeType.JSON);

      } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: error.message,
          message: "Insert failed"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    else if (action === 'insert1') {
      try {
        // Step 1: Extract data
        const formData = {};
        for (let key in params) {
          if (key !== 'action' && key !== 'sheetName') {
            formData[key] = params[key];
          }
        }

        // Optional: Parse maintenanceSchedule if it's a JSON string
        if (formData["Maintenance Schedule"]) {
          try {
            formData["Maintenance Schedule"] = JSON.parse(formData["Maintenance Schedule"]);
          } catch (_) { }
        }

        // Step 2: Generate Serial Number from sheet
        const headers = sheet.getRange(6, 1, 1, sheet.getLastColumn()).getValues()[0];

        // Step 3: Construct row in header order
        const newRow = headers.map((header) => {
          const value = formData[header];
          if (Array.isArray(value)) {
            return value.join(", ");
          }
          return value || "";
        });

        // Step 4: Append the new row
        sheet.appendRow(newRow);

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Row added successfully",
          rowCount: sheet.getLastRow()
        })).setMimeType(ContentService.MimeType.JSON);

      } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: error.message,
          message: "Insert failed"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    else if (action === 'update') {
      var taskNo = params.taskNo;
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var taskNoCol = headers.indexOf('Task No');

      if (taskNoCol === -1) {
        throw new Error("Task No column not found");
      }

      var rowIndex = -1;
      for (var i = 1; i < data.length; i++) {
        if (data[i][taskNoCol] === taskNo) {
          rowIndex = i + 1; // +1 because sheets are 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        throw new Error("Task not found with Task No: " + taskNo);
      }

      // Update each field that was provided
      var fieldsToUpdate = ['Task Status', 'Remarks', 'Actual Date', 'Image Link', 'File Name',
        'File Type', 'Sound Status', 'Temperature Status', 'Repair Cost', 'Maintenace Cost'];
      fieldsToUpdate.forEach(function (field) {
        if (params[field] !== undefined) {
          var colIndex = headers.indexOf(field);
          if (colIndex !== -1) {
            sheet.getRange(rowIndex, colIndex + 1).setValue(params[field]);
          }
        }
      });

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Task updated successfully"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    else if (action === 'update1') {
      var taskNo = params.taskNo;
      var data = sheet.getDataRange().getValues();
      var headers = data[5];

      var taskNoCol = headers.indexOf('Task No');
      if (taskNoCol === -1) taskNoCol = headers.indexOf('Repair Task No');
      if (taskNoCol === -1) throw new Error("Task No column not found");

      var rowIndex = -1;
      for (var i = 5; i < data.length; i++) {
        if (data[i][taskNoCol] === taskNo) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) {
        throw new Error("Task not found with Task No: " + taskNo);
      }

      // Get Bill No for finding common bills (based on Bill No matching)
      var billNoCol = headers.indexOf('Bill No.') !== -1 ? headers.indexOf('Bill No.') : headers.indexOf('Bill No');
      var parentBillNo = billNoCol !== -1 ? data[rowIndex - 1][billNoCol] : "";

      // Update parent task
      for (var key in params) {
        if (key === 'action' || key === 'sheetName' || key === 'taskNo') continue;
        var colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(rowIndex, colIndex + 1).setValue(params[key]);
        }
      }

      // If Actual Posting or Actual 4 is filled AND Bill No exists, update all tasks with same Bill No
      var commonBillsUpdated = 0;
      if ((params['Actual Posting'] || params['Actual 4']) && parentBillNo && parentBillNo !== '-' && parentBillNo !== '') {
        for (var j = 6; j < data.length; j++) {
          var currentBillNo = billNoCol !== -1 ? data[j][billNoCol] : "";
          var currentTaskNo = data[j][taskNoCol];

          // Update tasks with same Bill No (except the current one)
          if (currentBillNo === parentBillNo && currentTaskNo !== taskNo && currentBillNo !== '') {
            commonBillsUpdated++;
            for (var ckey in params) {
              if (ckey === 'action' || ckey === 'sheetName' || ckey === 'taskNo') continue;
              var ccolIndex = headers.indexOf(ckey);
              if (ccolIndex !== -1) {
                sheet.getRange(j + 1, ccolIndex + 1).setValue(params[ckey]);
              }
            }
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Task updated successfully",
        commonBillsUpdated: commonBillsUpdated
      })).setMimeType(ContentService.MimeType.JSON);
    }

    else if (action === 'updateRow') {
      try {
        var keyColumn = params.keyColumn;
        var keyValue = params.keyValue;

        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        var keyColIndex = headers.indexOf(keyColumn);

        if (keyColIndex === -1) {
          throw new Error("Key column '" + keyColumn + "' not found");
        }

        var rowIndex = -1; 
        for (var i = 1; i < data.length; i++) {
          if (data[i][keyColIndex]?.toString().trim() === keyValue?.toString().trim()) {
            rowIndex = i + 1; // 1-indexed
            break;
          }
        }

        if (rowIndex === -1) {
          throw new Error("Row not found with key: " + keyValue);
        }

        // Update each field that was provided
        for (let key in params) {
          if (key !== 'action' && key !== 'sheetName' && key !== 'keyColumn' && key !== 'keyValue') {
            var colIndex = headers.indexOf(key);
            if (colIndex !== -1) {
              sheet.getRange(rowIndex, colIndex + 1).setValue(params[key]);
            }
          }
        }

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Row updated successfully"
        })).setMimeType(ContentService.MimeType.JSON);

      } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: error.message,
          message: "Update failed"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    else if (action === 'addToMaster') {
      // Adds a new value to a specific column in the Master sheet (no duplicates)
      try {
        var masterSheetName = params.sheetName || "Master";
        var columnName = params.columnName;
        var newValue = (params.value || "").toString().trim();

        if (!columnName || !newValue) {
          throw new Error("columnName and value are required");
        }

        var ss2 = SpreadsheetApp.openById(params.sheetId || SHEET_ID);
        var masterSheet = ss2.getSheetByName(masterSheetName);
        if (!masterSheet) throw new Error("Sheet '" + masterSheetName + "' not found");

        var masterData = masterSheet.getDataRange().getValues();
        var masterHeaders = masterData[0];
        var colIdx = masterHeaders.indexOf(columnName);
        if (colIdx === -1) throw new Error("Column '" + columnName + "' not found in " + masterSheetName);

        // Check for duplicates (case-insensitive)
        var existingValues = masterData.slice(1).map(function(r) {
          return (r[colIdx] || "").toString().trim().toLowerCase();
        });
        if (existingValues.indexOf(newValue.toLowerCase()) !== -1) {
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: "Value already exists, no duplicate added"
          })).setMimeType(ContentService.MimeType.JSON);
        }

        // Find first empty row in that column (after header)
        var lastRow = masterSheet.getLastRow();
        masterSheet.getRange(lastRow + 1, colIdx + 1).setValue(newValue);

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Value added to Master sheet successfully"
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (masterErr) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "addToMaster failed: " + masterErr.message
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    else {
      throw new Error("Unknown action: " + action);
    }
  } catch (error) {
    console.error("Error in doPost:", error.message, error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      message: "Failed to process request: " + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleLogin(username, password) {
  try {
    if (!username || !password) {
      return { success: false, error: "Username and password are required" };
    }

    const ss = SpreadsheetApp.openById("1x74bX62-1-plLYCkTv7nA4OdkQpM3IJTMs6HLLdt4lI");
    const sheet = ss.getSheetByName("Repair Login");
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const sheetUsername = row[0]?.toString().trim(); // Column A: User Name
      const sheetPassword = row[1]?.toString().trim(); // Column B: Password
      const sheetRole = row[2]?.toString().trim().toLowerCase(); // Column C: Role
      const sheetPage = row[3]?.toString().trim(); // Column D: Page Access
      const sheetManual = row[4]?.toString().trim(); // Column E: Manual

      const usernameMatch = sheetUsername?.toLowerCase() === username.toLowerCase();
      const passwordMatch = sheetPassword === password;

      if (usernameMatch && passwordMatch) {
        return {
          success: true,
          user: {
            id: sheetUsername,
            username: sheetUsername,
            role: sheetRole,
            page: sheetPage,
            manual: sheetManual,
            name: sheetUsername
          }
        };
      }
    }

    return { success: false, error: "Invalid username or password" };

  } catch (error) {
    return {
      success: false,
      error: "Login system error: " + error.toString()
    };
  }
}

/**
 * Run this function once in Google Apps Script Editor to automatically
 * add the 24 comparison headers in Row 6 of "Repair System" sheet starting at Col 62 (BJ).
 */
function addVendorComparisonColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Repair System");
  if (!sheet) {
    Logger.log("Repair System sheet not found");
    return;
  }

  var newHeaders = [
    // Vendor 1 Details
    "Vendor Name 1",
    "(Transporter Name) 1",
    "Transportation Charges 1",
    "Weighment Slip 1",
    "Lead Time To Deliver 1",
    "Vendor 1 Payment Type",
    "Advance Payment 1",

    // Vendor 2 Details
    "Vendor Name 2",
    "(Transporter Name) 2",
    "Transportation Charges 2",
    "Weighment Slip 2",
    "Lead Time To Deliver 2",
    "Vendor 2 Payment Type",
    "Advance Payment 2",

    // Vendor 3 Details
    "Vendor Name 3",
    "(Transporter Name) 3",
    "Transportation Charges 3",
    "Weighment Slip 3",
    "Lead Time To Deliver 3",
    "Vendor 3 Payment Type",
    "Advance Payment 3",

    // Selection & Approval
    "Approved Vendor Name",
    "Approved Payment Term",
    "ThreePartyStatus"
  ];

  // Starting at Row 6, Column 62 (Col BJ, right after 'Payment type 2' at Col 61)
  sheet.getRange(6, 62, 1, newHeaders.length).setValues([newHeaders]);
  Logger.log("Successfully added " + newHeaders.length + " headers in Row 6 starting at Col 62 (BJ)!");
}

/**
 * Run this function once in Google Apps Script Editor to automatically
 * add all 31 Advance Payment workflow headers in Row 6 of "Repair FMS Advance Payment" sheet
 * starting at Column 11 (Col K, right after 'To Be Paid Amount' at Col 10).
 */
function addAdvancePaymentWorkflowColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Repair FMS Advance Payment");
  if (!sheet) {
    Logger.log("Repair FMS Advance Payment sheet not found");
    return;
  }

  var newHeaders = [
    // A. Basic & Approval Info
    "Firm Name",
    "Department",
    "Management Approval Date",
    "Management Remark",

    // B. Step 2: Posting
    "Planned Posting",
    "Actual Posting",
    "Posting Voucher No",
    "Posting Done By",

    // C. Step 3: Make Payment (Advance Release)
    "Planned Payment",
    "Actual Payment Date",
    "Advance Payment UTR / Cheque No",
    "Advance Amount Paid",
    "Payment Done By",

    // D. Step 4: Check Machine
    "Planned Check Machine",
    "Actual Check Machine Date",
    "Bill Date",
    "Bill Image Link",
    "Checked By",

    // E. Step 5: Store In
    "Planned Store In",
    "Actual Store In Date",
    "Received Quantity",
    "Store In Done By",

    // F. Step 6: Full Billing
    "Planned Full Billing",
    "Actual Full Billing Date",
    "Balance Amount To Pay",
    "Balance Payment UTR / Cheque No",
    "Billing Status",

    // G. Step 7: Accounts
    "Planned Accounts",
    "Actual Accounts Date",
    "Accounts Status",
    "Accounts Remark"
  ];

  // Starting at Row 6, Column 11 (Col K, right after 'To Be Paid Amount' at Col 10)
  sheet.getRange(6, 11, 1, newHeaders.length).setValues([newHeaders]);
  Logger.log("Successfully added " + newHeaders.length + " headers in Row 6 of Repair FMS Advance Payment starting at Col 11 (K)!");
}

/**
 * Run this function once in Google Apps Script Editor to automatically
 * add "Common Bill Tasks" and "Common Parent Task" headers in Row 6 of "Repair System" sheet.
 */
function addCommonBillColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Repair System");
  if (!sheet) {
    Logger.log("Repair System sheet not found");
    return;
  }

  var headers = sheet.getRange(6, 1, 1, sheet.getLastColumn()).getValues()[0];
  var toAdd = [];
  if (headers.indexOf("Common Bill Tasks") === -1) toAdd.push("Common Bill Tasks");
  if (headers.indexOf("Common Parent Task") === -1) toAdd.push("Common Parent Task");

  if (toAdd.length > 0) {
    sheet.getRange(6, headers.length + 1, 1, toAdd.length).setValues([toAdd]);
    Logger.log("Successfully added headers: " + toAdd.join(", ") + " at Row 6!");
  } else {
    Logger.log("Headers already exist in Row 6!");
  }
}

/**
 * Run this function once in Google Apps Script Editor to automatically
 * add "Process Remark" header in Row 6 of "Repair System" sheet.
 */
function addProcessRemarkColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Repair System");
  if (!sheet) {
    Logger.log("Repair System sheet not found");
    return;
  }

  var headers = sheet.getRange(6, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf("Process Remark") === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(6, nextCol).setValue("Process Remark");
    Logger.log("Successfully added 'Process Remark' header at Col " + nextCol + " of Row 6!");
  } else {
    Logger.log("'Process Remark' already exists in Row 6!");
  }
}

/**
 * Run this function once in Google Apps Script Editor to automatically
 * add "Common Bill Tasks" header in Row 6 of "Repair FMS Advance Payment" sheet.
 */
function addCommonBillTasksToAdvance() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Repair FMS Advance Payment");
  if (!sheet) {
    Logger.log("Repair FMS Advance Payment sheet not found");
    return;
  }

  var headers = sheet.getRange(6, 1, 1, sheet.getLastColumn()).getValues()[0];
  var existingIndex = headers.indexOf("Common Bill Tasks");
  if (existingIndex !== -1) {
    Logger.log("'Common Bill Tasks' already exists at column " + (existingIndex + 1));
    return;
  }

  var nextCol = sheet.getLastColumn() + 1;
  sheet.getRange(6, nextCol).setValue("Common Bill Tasks");
  Logger.log("Successfully added 'Common Bill Tasks' header at Col " + nextCol + " of Row 6 in Repair FMS Advance Payment!");
}



