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
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
    const blob = Utilities.newBlob(decoded, mimeType, fileName);

    // Get the folder reference
    const folder = DriveApp.getFolderById(folderId);

    // Upload the file to the folder
    const file = folder.createFile(blob);

    // Make the file accessible via link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

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
    // Log the incoming data for debugging
    // console.log("Received POST request with parameters:", JSON.stringify(e.parameter));

    var params = e.parameter;

    // Check if this is a file upload action
    if (params.action === 'uploadFile') {
      // Extract file upload parameters
      var base64Data = params.base64Data;
      var fileName = params.fileName;
      var mimeType = params.mimeType;
      var folderId = params.folderId;

      // Validate required parameters
      if (!base64Data || !fileName || !mimeType || !folderId) {
        throw new Error("Missing required parameters for file upload");
      }

      // Upload the file to Google Drive
      var fileUrl = uploadFileToDrive(base64Data, fileName, mimeType, folderId);

      // Return the file URL
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileUrl: fileUrl
      })).setMimeType(ContentService.MimeType.JSON);
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
      // // Add a new row at the end of the sheet
      // var rowData = JSON.parse(params.rowData);
      // sheet.appendRow(rowData);
      // return ContentService.createTextOutput(JSON.stringify({ success: true }));

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

    else if (action === 'update') {

      var taskNo = params.taskNo;
      // Find the row with matching Task No
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
      var headers = data[5]; // fix here

      var taskNoCol = headers.indexOf('Task No');
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

      // Update any provided field that matches a header in row 6
      for (var key in params) {
        if (key === 'action' || key === 'sheetName' || key === 'taskNo') continue;
        var colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(rowIndex, colIndex + 1).setValue(params[key]);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Task updated successfully"
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

    const ss = SpreadsheetApp.openById("1Gi6EVJ6ATYOmVPJDm-flLM3tuZazsqt11f9dhwUqrVQ");
    const sheet = ss.getSheetByName("Login Sheet");
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
