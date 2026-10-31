/**
 * SHTPEC Room Booking System - Web App Backend with Role-Based Access Control
 */

const SHEET_LOG = "Booking Log / 預約紀錄";
const SHEET_SETUP = "Setup - DO NOT EDIT";
const SHEET_USERS = "Users / 用戶管理";

// [ACTION_REQUIRED]: Set 'SUPER_ADMIN_PASSWORD' under Project Settings > Script Properties
const DEFAULT_SUPER_ADMIN_USERNAME = "admin";
const DEFAULT_SUPER_ADMIN_DISPLAY_NAME = "超級管理員";

// System Room List definitions
const ALL_ROOMS = [
  "Library / 圖書房",
  "Room 2 / 二號房",
  "Room 3 / 三號房",
  "Room 4 / 四號房",
  "Room 5 / 五號房",
  "Room A / A房",
  "Room B / B房",
  "Room C / C房",
  "Room D / D房",
  "Playground / 遊樂場",
  "Hall / 禮堂",
  "Public Area / 中庭 (2樓)"
];

// Default Equipment List definitions
const DEFAULT_EQUIPMENT = [
  "毋須任何 / None",
  "Windows Laptop",
  "MacBook",
  "Chromebook",
  "預約禮堂音響 / Hall Sound",
  "禮堂燈光 / Hall Lighting",
  "禮堂直播 / Hall Live Stream",
  "咪 (房間音響) / Mic (Room Audio)",
  "電視 / TV",
  "投影機 / Projector"
];

/**
 * Helper function to compute SHA-256 password hash.
 */
function hashPassword(password) {
  if (!password) return "";
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return rawHash.map(byte => {
    const v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

// Web App Entry Point
function doGet() {
  const template = HtmlService.createTemplateFromFile("Index");
  return template.evaluate()
    .setTitle("SHTPEC 房間預訂與器材借用系統 | Room Booking System")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Ensure Users sheet exists and returns initialized sheet
function getUsersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_USERS);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_USERS);
    sheet.appendRow(["Username", "Password", "DisplayName", "Role", "CreatedAt"]);
    
    // Retrieve default super admin password from Script Properties
    const initialPassword = PropertiesService.getScriptProperties().getProperty("SUPER_ADMIN_PASSWORD") || "CHANGE_ME_IN_SCRIPT_PROPERTIES";
    
    sheet.appendRow([
      DEFAULT_SUPER_ADMIN_USERNAME,
      hashPassword(initialPassword),
      DEFAULT_SUPER_ADMIN_DISPLAY_NAME,
      "SUPER_ADMIN",
      new Date()
    ]);
  }
  return sheet;
}

// Internal User Verification helper
function authenticateUser(username, password) {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const inputHash = hashPassword(password);
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const storedPass = row[1] ? row[1].toString().trim() : "";
    
    if (row[0].toString().trim() === username) {
      // Check hashed password match
      if (storedPass === inputHash) {
        return {
          rowIndex: i + 1,
          username: row[0].toString().trim(),
          displayName: row[2] ? row[2].toString().trim() : row[0].toString().trim(),
          role: row[3] ? row[3].toString().trim() : "EDITOR"
        };
      } 
      // Automatic migration: if legacy plaintext password matches, upgrade to SHA-256 hash
      else if (storedPass === password) {
        sheet.getRange(i + 1, 2).setValue(inputHash);
        return {
          rowIndex: i + 1,
          username: row[0].toString().trim(),
          displayName: row[2] ? row[2].toString().trim() : row[0].toString().trim(),
          role: row[3] ? row[3].toString().trim() : "EDITOR"
        };
      }
    }
  }
  return null;
}

// User Login Verification API
function verifyUser(username, password) {
  const user = authenticateUser(username, password);
  if (user) {
    return {
      success: true,
      user: {
        username: user.username,
        displayName: user.displayName,
        role: user.role
      }
    };
  }
  return { success: false, message: "帳號或密碼錯誤！" };
}

// Change Own Password API (For all logged in users)
function changeOwnPassword(username, currentPassword, newPassword) {
  const user = authenticateUser(username, currentPassword);
  if (!user) {
    return { success: false, message: "目前密碼驗證失敗。" };
  }
  if (!newPassword || newPassword.trim().length < 4) {
    return { success: false, message: "新密碼長度至少需要 4 個字元。" };
  }

  const sheet = getUsersSheet();
  sheet.getRange(user.rowIndex, 2).setValue(hashPassword(newPassword.trim()));
  return { success: true, message: "密碼修改成功！" };
}

// --- USER MANAGEMENT (SUPER_ADMIN ONLY) ---

function getUsersList(authUsername, authPassword) {
  const auth = authenticateUser(authUsername, authPassword);
  if (!auth || auth.role !== "SUPER_ADMIN") {
    throw new Error("無權限執行此操作 (需要超級管理員權限)");
  }

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const users = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    users.push({
      rowIndex: i + 1,
      username: row[0].toString().trim(),
      displayName: row[2] ? row[2].toString().trim() : "",
      role: row[3] ? row[3].toString().trim() : "EDITOR"
    });
  }
  return users;
}

function createUser(authUsername, authPassword, newUser) {
  const auth = authenticateUser(authUsername, authPassword);
  if (!auth || auth.role !== "SUPER_ADMIN") {
    return { success: false, message: "權限不足，僅超級管理員可建立帳號。" };
  }

  if (!newUser.username || !newUser.password || !newUser.displayName || !newUser.role) {
    return { success: false, message: "請填寫所有欄位 (帳號、密碼、姓名與角色)。" };
  }

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const cleanUsername = newUser.username.trim();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim().toLowerCase() === cleanUsername.toLowerCase()) {
      return { success: false, message: "此帳號已被使用！" };
    }
  }

  sheet.appendRow([
    cleanUsername,
    hashPassword(newUser.password.trim()),
    newUser.displayName.trim(),
    newUser.role.trim(),
    new Date()
  ]);

  return { success: true, message: "成功建立新用戶！" };
}

function updateUser(authUsername, authPassword, targetUsername, updatedData) {
  const auth = authenticateUser(authUsername, authPassword);
  if (!auth || auth.role !== "SUPER_ADMIN") {
    return { success: false, message: "權限不足，僅超級管理員可修改用戶資料。" };
  }

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === targetUsername) {
      if (updatedData.displayName) {
        sheet.getRange(i + 1, 3).setValue(updatedData.displayName.trim());
      }
      if (updatedData.role) {
        sheet.getRange(i + 1, 4).setValue(updatedData.role.trim());
      }
      if (updatedData.newPassword && updatedData.newPassword.trim() !== "") {
        sheet.getRange(i + 1, 2).setValue(hashPassword(updatedData.newPassword.trim()));
      }
      return { success: true, message: "用戶資料修改成功！" };
    }
  }
  return { success: false, message: "找不到指定的用戶。" };
}

function deleteUser(authUsername, authPassword, targetUsername) {
  const auth = authenticateUser(authUsername, authPassword);
  if (!auth || auth.role !== "SUPER_ADMIN") {
    return { success: false, message: "權限不足，僅超級管理員可刪除用戶。" };
  }

  if (targetUsername === authUsername) {
    return { success: false, message: "無法刪除目前登入的超級管理員帳號！" };
  }

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === targetUsername) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "已成功刪除該用戶！" };
    }
  }
  return { success: false, message: "找不到指定的用戶。" };
}

// --- SYSTEM META & BOOKINGS API ---

function getSystemMeta() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const setupSheet = ss.getSheetByName(SHEET_SETUP);
  
  let departments = [];
  
  if (setupSheet) {
    const data = setupSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] && data[i][2].toString().trim() !== "") {
        departments.push(data[i][2].toString().trim());
      }
    }
  }
  
  if (departments.length === 0) {
    departments = ["教會同工", "基督少年軍", "約翰團", "以諾團", "約書亞團", "安德烈團", "天使團", "大衛團", "紅海團", "摩西團", "雅各團", "保羅團", "彼得團", "以利沙團", "迦南團", "其他"];
  }

  return {
    rooms: ALL_ROOMS,
    departments: [...new Set(departments)],
    equipment: DEFAULT_EQUIPMENT
  };
}

// Helper to extract booked room names array from any log row
function extractBookedRoomsFromRow(row) {
  const roomCols = [row[3], row[4], row[5], row[6], row[7]];
  const defaultMap = ["Room 1", "Room 2", "Room 3", "Room 4", "Room 5"];
  const booked = [];

  roomCols.forEach((val, idx) => {
    if (!val) return;
    if (typeof val === 'boolean' && val) {
      booked.push(ALL_ROOMS[idx] || defaultMap[idx]);
    } else if (typeof val === 'string' && val.trim()) {
      const parts = val.split(',').map(s => s.trim()).filter(Boolean);
      parts.forEach(p => booked.push(p));
    }
  });

  return [...new Set(booked)];
}

function getScheduleByDate(targetDateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LOG);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const bookings = [];
  const queryDate = new Date(targetDateStr).toDateString();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDate = row[0] instanceof Date ? row[0].toDateString() : new Date(row[0]).toDateString();
    
    if (rowDate === queryDate) {
      bookings.push({
        id: i + 1,
        date: formatDate(row[0]),
        startTime: formatTime(row[1]),
        endTime: formatTime(row[2]),
        bookedRooms: extractBookedRoomsFromRow(row),
        department: row[8] || "",
        activity: row[9] || "",
        notes: row[10] || "",
        bookerName: row[11] || "",
        phone: row[12] || ""
      });
    }
  }
  return bookings;
}

function getScheduleByDateRange(startDateStr, endDateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LOG);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const bookings = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  start.setHours(0,0,0,0);
  end.setHours(23,59,59,999);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    const d = row[0] instanceof Date ? row[0] : new Date(row[0]);
    if (isNaN(d.getTime())) continue;

    if (d >= start && d <= end) {
      bookings.push({
        id: i + 1,
        date: formatDate(row[0]),
        startTime: formatTime(row[1]),
        endTime: formatTime(row[2]),
        bookedRooms: extractBookedRoomsFromRow(row),
        department: row[8] || "",
        activity: row[9] || "",
        notes: row[10] || "",
        bookerName: row[11] || "",
        phone: row[12] || ""
      });
    }
  }
  return bookings;
}

function submitBooking(form) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_LOG);
    if (!sheet) throw new Error("找不到工作表: " + SHEET_LOG);
    
    if (!form.date || !form.startTime || !form.endTime || !form.bookerName || !form.phone) {
      return { success: false, message: "請填寫所有必填欄位 (日期、時間、預約者名稱、聯絡電話)。" };
    }
    
    const selectedRooms = form.selectedRooms || [];
    if (!Array.isArray(selectedRooms) || selectedRooms.length === 0) {
      return { success: false, message: "請至少選擇一個預訂房間。" };
    }
    
    if (form.startTime >= form.endTime) {
      return { success: false, message: "結束時間必須晚於開始時間。" };
    }
    
    const data = sheet.getDataRange().getValues();
    const newDateStr = new Date(form.date).toDateString();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const existingDateStr = row[0] instanceof Date ? row[0].toDateString() : new Date(row[0]).toDateString();
      
      if (existingDateStr === newDateStr) {
        const existStart = formatTime(row[1]);
        const existEnd = formatTime(row[2]);
        
        if (form.startTime < existEnd && form.endTime > existStart) {
          const existRooms = extractBookedRoomsFromRow(row);
          const hasOverlap = selectedRooms.some(r => existRooms.includes(r));
          if (hasOverlap) {
            return {
              success: false,
              message: `時段衝突！該時間 (${existStart} - ${existEnd}) 內所選房間已被預約：${row[9] || "其他活動"}`
            };
          }
        }
      }
    }
    
    // Distribute selected rooms cleanly across cols D..H
    const rCols = ["", "", "", "", ""];
    for (let i = 0; i < selectedRooms.length && i < 5; i++) {
      rCols[i] = selectedRooms[i];
    }
    if (selectedRooms.length > 5) {
      rCols[4] = selectedRooms.slice(4).join(", ");
    }

    // Process equipment details cleanly into notes column
    let finalNotes = form.notes || "";
    const eqList = form.selectedEquipment || [];
    const customEq = form.customEquipment ? form.customEquipment.trim() : "";
    
    let eqParts = [];
    if (eqList.length > 0 && !eqList.includes("毋須任何 / None")) {
      eqParts.push(eqList.join(", "));
    }
    if (customEq) {
      eqParts.push(`自訂: ${customEq}`);
    }
    
    if (eqParts.length > 0) {
      finalNotes = `[器材: ${eqParts.join(" | ")}] ${finalNotes}`.trim();
    }

    const newRow = [
      form.date,
      form.startTime,
      form.endTime,
      rCols[0],
      rCols[1],
      rCols[2],
      rCols[3],
      rCols[4],
      form.department || "",
      form.activity || "",
      finalNotes,
      form.bookerName,
      form.phone,
      new Date()
    ];
    
    sheet.appendRow(newRow);
    return { success: true, message: "房間及器材預約成功！" };
  } catch (err) {
    return { success: false, message: "系統錯誤: " + err.message };
  } finally {
    lock.releaseLock();
  }
}

// Fetch Bookings for Admin Console (SUPER_ADMIN, ADMIN, EDITOR)
function getAdminBookings(username, password) {
  const user = authenticateUser(username, password);
  if (!user) {
    throw new Error("無效授權");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LOG);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    list.push({
      rowIndex: i + 1,
      date: formatDate(row[0]),
      startTime: formatTime(row[1]),
      endTime: formatTime(row[2]),
      bookedRooms: extractBookedRoomsFromRow(row),
      department: row[8] || "",
      activity: row[9] || "",
      notes: row[10] || "",
      bookerName: row[11] || "",
      phone: row[12] || ""
    });
  }
  return list.reverse();
}

// Delete Booking (SUPER_ADMIN, ADMIN, EDITOR)
function deleteBooking(username, password, rowIndex) {
  const user = authenticateUser(username, password);
  if (!user) {
    return { success: false, message: "未經授權的操作" };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LOG);
  if (!sheet) return { success: false, message: "找不到工作表" };
  
  if (rowIndex > 1 && rowIndex <= sheet.getLastRow()) {
    sheet.deleteRow(rowIndex);
    return { success: true, message: "預訂已成功取消/刪除！" };
  }
  return { success: false, message: "找不到對應列數" };
}

// Update Existing Booking (SUPER_ADMIN, ADMIN, EDITOR)
function updateBooking(username, password, rowIndex, updatedForm) {
  const user = authenticateUser(username, password);
  if (!user) {
    return { success: false, message: "未經授權的操作" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LOG);
  if (!sheet) return { success: false, message: "找不到工作表" };

  if (rowIndex <= 1 || rowIndex > sheet.getLastRow()) {
    return { success: false, message: "無效的紀錄位置" };
  }

  const selectedRooms = updatedForm.selectedRooms || [];
  const rCols = ["", "", "", "", ""];
  for (let i = 0; i < selectedRooms.length && i < 5; i++) {
    rCols[i] = selectedRooms[i];
  }
  if (selectedRooms.length > 5) {
    rCols[4] = selectedRooms.slice(4).join(", ");
  }

  let finalNotes = updatedForm.notes || "";
  const eqList = updatedForm.selectedEquipment || [];
  const customEq = updatedForm.customEquipment ? updatedForm.customEquipment.trim() : "";
  
  let eqParts = [];
  if (eqList.length > 0 && !eqList.includes("毋須任何 / None")) {
    eqParts.push(eqList.join(", "));
  }
  if (customEq) {
    eqParts.push(`自訂: ${customEq}`);
  }
  
  if (eqParts.length > 0 && !finalNotes.includes("[器材:")) {
    finalNotes = `[器材: ${eqParts.join(" | ")}] ${finalNotes}`.trim();
  }

  sheet.getRange(rowIndex, 1, 1, 13).setValues([[
    updatedForm.date,
    updatedForm.startTime,
    updatedForm.endTime,
    rCols[0],
    rCols[1],
    rCols[2],
    rCols[3],
    rCols[4],
    updatedForm.department || "",
    updatedForm.activity || "",
    finalNotes,
    updatedForm.bookerName || "",
    updatedForm.phone || ""
  ]]);

  return { success: true, message: "預約行程與器材需求修改成功！" };
}

// Helpers
function formatDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return val.toString();
}

function formatTime(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "HH:mm");
  }
  const str = val.toString().trim();
  return str.length === 5 ? str : str.substring(0, 5);
}
