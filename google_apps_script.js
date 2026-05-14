// แก้ไขส่วนนี้ให้เป็นเวอร์ชันที่รองรับทั้ง GET และ POST เพื่อให้ง่ายต่อการทดสอบครับ

// 💡 หากคุณเจอ Error "Cannot read properties of null (reading 'getSheets')"
// ให้ก๊อปปี้ ID ของ Google Sheet จากหน้าต่าง URL (เฉพาะส่วนตัวอักษรยาวๆ ตรงกลาง)
// เช่น https://docs.google.com/spreadsheets/d/1AbC...xYz/edit ให้เอาแค่ 1AbC...xYz มาใส่ด้านล่างครับ
// หากใส่ ID ไว้ ระบบจะทำงานได้ 100% ครับ
const SPREADSHEET_ID = "1DlIwl4EPWCmG5jRsYjtz-DePuU5ehOmjqCaxYrU85CM";

function doGet(e) {
  if (e.parameter.id && e.parameter.action) {
    let loanData = {
      actionDate: e.parameter.actionDate,
      principal: e.parameter.principal,
      dueDate: e.parameter.dueDate,
      daysBorrowed: e.parameter.daysBorrowed,
      interestRate: e.parameter.interestRate,
      penalty: e.parameter.penalty,
      renewFromDate: e.parameter.renewFromDate
    };
    return processData(e.parameter.id, e.parameter.action, loanData);
  }
  return ContentService.createTextOutput("API พร้อมทำงานครับ");
}

function doPost(e) {
  try {
    if (e.postData && e.postData.contents) {
      const payload = JSON.parse(e.postData.contents);
      return processData(payload.id, payload.action, payload.loanData);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function processData(id, action, loanData) {
  try {
    let ss;
    if (SPREADSHEET_ID !== "") {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "ไม่พบ Spreadsheet! กรุณาใส่ SPREADSHEET_ID"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const SHEET_NAME = "เม.ย.";
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "ไม่พบแผ่นงานชื่อ: " + SHEET_NAME
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const data = sheet.getDataRange().getValues();
    const today = new Date();
    // Default to today, but use actionDate if provided
    const dateStr = (loanData && loanData.actionDate) ? loanData.actionDate : Utilities.formatDate(today, "Asia/Bangkok", "dd/MM/yyyy");

    if (action === 'NEW_LOAN') {
      let targetRowIndex = -1;
      let generatedId = "L" + today.getTime().toString().slice(-6);

      // ค้นหาบรรทัดที่เตรียมรหัสลูกค้าไว้แล้ว (มี A แต่ B ว่าง)
      for (let i = 3; i < data.length; i++) {
        let colA = String(data[i][0]).trim();
        let colB = String(data[i][1]).trim();
        if (colA !== "" && colB === "") {
          targetRowIndex = i + 1;
          generatedId = colA; // ใช้รหัสลูกค้าที่เตรียมไว้
          break;
        }
      }

      const borrowDateStr = loanData.borrowDate || dateStr;
      let dueDateStr = loanData.dueDate;

      // ถ้าไม่ได้ส่ง dueDate มา ให้คำนวณจากจำนวนวันที่ยืม
      if (!dueDateStr) {
        let parts = borrowDateStr.split("/");
        let bDate = new Date(parts[2], parts[1] - 1, parts[0]);
        let dDate = new Date(bDate.getTime() + (loanData.daysBorrowed * 24 * 60 * 60 * 1000));
        dueDateStr = Utilities.formatDate(dDate, "Asia/Bangkok", "dd/MM/yyyy");
      }

      if (targetRowIndex !== -1) {
        sheet.getRange(targetRowIndex, 2).setValue(loanData.name);
        sheet.getRange(targetRowIndex, 3).setValue(loanData.principal);
        sheet.getRange(targetRowIndex, 4).setValue(borrowDateStr);
        sheet.getRange(targetRowIndex, 5).setValue(dueDateStr);
        sheet.getRange(targetRowIndex, 7).setValue(loanData.daysBorrowed);
        sheet.getRange(targetRowIndex, 9).setValue(loanData.interestRate || 20); // Default 20%
        sheet.getRange(targetRowIndex, 13).setValue(loanData.status || "ยังไม่ชำระ");
      } else {
        const newRow = Array(21).fill("");
        newRow[0] = generatedId;
        newRow[1] = loanData.name;
        newRow[2] = loanData.principal;
        newRow[3] = borrowDateStr;
        newRow[4] = dueDateStr;
        newRow[6] = loanData.daysBorrowed;
        newRow[8] = loanData.interestRate || 20;
        newRow[12] = loanData.status || "ยังไม่ชำระ";
        sheet.appendRow(newRow);
      }
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Added new loan", id: generatedId })).setMimeType(ContentService.MimeType.JSON);
    }

    let foundRowIndex = -1;
    let originalRowData = null;

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(id).trim().toLowerCase()) {
        foundRowIndex = i;
        originalRowData = data[i];
        break;
      }
    }

    if (action === 'EDIT_LOAN') {
      if (foundRowIndex !== -1) {
        if (loanData.principal) sheet.getRange(foundRowIndex + 1, 3).setValue(loanData.principal);
        if (loanData.dueDate) sheet.getRange(foundRowIndex + 1, 5).setValue(loanData.dueDate);
        if (loanData.daysBorrowed) sheet.getRange(foundRowIndex + 1, 7).setValue(loanData.daysBorrowed);
        if (loanData.interestRate) sheet.getRange(foundRowIndex + 1, 9).setValue(loanData.interestRate);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Edited loan " + id })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "ID not found: " + id })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (foundRowIndex !== -1) {
      // เปลี่ยนสถานะรายการเก่า และอัปเดตวันที่จ่ายจริง
      sheet.getRange(foundRowIndex + 1, 13).setValue(action);
      sheet.getRange(foundRowIndex + 1, 6).setValue(dateStr);

      // เขียนค่าปรับลง column K (col 11) — 0 หมายความว่าไม่มีค่าปรับ
      if (loanData && loanData.penalty !== undefined) {
        sheet.getRange(foundRowIndex + 1, 11).setValue(Number(loanData.penalty) || 0);
      }

      if (action === 'ต่อดอก') {
        const name = originalRowData[1];
        const principal = originalRowData[2];
        const daysBorrowed = parseInt(originalRowData[6]) || 7;
        const interestRate = originalRowData[8];

        // ใช้ renewFromDate เป็นวันเริ่มรอบใหม่ ถ้าไม่มีให้ใช้ actionDate แล้วค่อย fallback เป็นวันนี้
        let baseDateObj = today;
        const renewStr = (loanData && loanData.renewFromDate) ? loanData.renewFromDate : (loanData && loanData.actionDate ? loanData.actionDate : null);
        if (renewStr) {
          let parts = renewStr.split("/");
          if (parts.length === 3) {
            baseDateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
        }
        const newBorrowDateStr = Utilities.formatDate(baseDateObj, "Asia/Bangkok", "dd/MM/yyyy");

        const newDueDateObj = new Date(baseDateObj.getTime() + (daysBorrowed * 24 * 60 * 60 * 1000));
        const newDueDateStr = Utilities.formatDate(newDueDateObj, "Asia/Bangkok", "dd/MM/yyyy");

        // หาบรรทัดที่เตรียมรหัสลูกค้าไว้แล้ว (คอลัมน์ A มีค่า) แต่ยังไม่ได้ใส่ชื่อลูกค้า (คอลัมน์ B ว่าง)
        // ข้อมูลเริ่มที่แถวที่ 4 (index 3)
        let targetRowIndex = -1;
        for (let i = 3; i < data.length; i++) {
          let colA = String(data[i][0]).trim();
          let colB = String(data[i][1]).trim();
          if (colA !== "" && colB === "") {
            targetRowIndex = i + 1; // +1 เพราะ sheet.getRange เริ่มที่ 1
            break;
          }
        }

        if (targetRowIndex !== -1) {
          // นำข้อมูลไปใส่ในบรรทัดที่หาเจอ โดยอัปเดตเฉพาะช่องที่ต้องกรอก (เพื่อป้องกันการทับสูตรในช่องอื่น)
          sheet.getRange(targetRowIndex, 2).setValue(name);             // ชื่อ (B)
          sheet.getRange(targetRowIndex, 3).setValue(principal);        // เงินต้น (C)
          sheet.getRange(targetRowIndex, 4).setValue(newBorrowDateStr); // วันที่ยืม (D)
          sheet.getRange(targetRowIndex, 5).setValue(newDueDateStr);    // วันครบกำหนด (E)
          sheet.getRange(targetRowIndex, 7).setValue(daysBorrowed);     // จำนวนวัน (G)
          sheet.getRange(targetRowIndex, 9).setValue(interestRate);     // ดอกเบี้ย (I)
          sheet.getRange(targetRowIndex, 13).setValue("ยังไม่ชำระ");     // สถานะ (M)
        } else {
          // ถ้าระบบหาบรรทัดว่างที่เตรียมรหัสไว้ไม่เจอ ให้สร้างต่อท้ายใหม่เลย
          const newId = "R" + today.getTime().toString().slice(-6);
          const newRow = Array(21).fill("");
          newRow[0] = newId;
          newRow[1] = name;
          newRow[2] = principal;
          newRow[3] = newBorrowDateStr;
          newRow[4] = newDueDateStr;
          newRow[6] = daysBorrowed;
          newRow[8] = interestRate;
          newRow[12] = "ยังไม่ชำระ";
          sheet.appendRow(newRow);
        }
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Updated " + id })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "ID not found: " + id })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.JSON).setHeaders({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
}
