/**
 * SHTPEC Room Booking System - Web App Backend with Role-Based Access Control & Booking Approvals
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

// Position definitions
const POSITIONS = [
  "團長 / Leader",
  "教會長執 / Elder & Deacon",
  "教會傳道人 / Pastor & Minister",
  "幹事/同工 / Staff",
  "其他 / Other"
];

// Auto-approved positions definition (毋須批核崗位)
const AUTO_APPROVE_POSITIONS = [
  "團長 / Leader",
  "教會長執 / Elder & Deacon",
  "教會傳道人 / Pastor & Minister",
  "幹事/同工 / Staff"
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
    .setTitle("SHTPEC 房間預訂與即時日程系統 | Room Booking System")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Fetch currently logged in Google user email address.
 */
function getGoogleUser() {
  const activeUserEmail = Session.getActiveUser().getEmail();
  return { email: activeUserEmail || "" };
}

// Ensure Users sheet exists and returns initialized sheet
function getUsersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_USERS);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_USERS);
    sheet.appendRow(["Username", "Password", "DisplayName", "Role", "CreatedAt", "GoogleEmail"]);
    
    // Retrieve default super admin password from Script Properties
    const initialPassword = PropertiesService.getScriptProperties().getProperty("SUPER_ADMIN_PASSWORD") || "CHANGE_ME_IN_SCRIPT_PROPERTIES";
    
    sheet.appendRow([
      DEFAULT_SUPER_ADMIN_USERNAME,
      hashPassword(initialPassword),
      DEFAULT_SUPER_ADMIN_DISPLAY_NAME,
      "SUPER_ADMIN",
      new Date(),
      ""
    ]);
  } else {
    // Ensure header column for GoogleEmail exists
    const lastCol = Math.max(sheet.getLastColumn(), 6);
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    if (!headers[5] || headers[5].toString().trim() !== "GoogleEmail") {
      sheet.getRange(1, 6).setValue("GoogleEmail");
    }
  }
  return sheet;
}

// Internal User Verification helper
function authenticateUser(username, password) {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  
  const isGoogleAuth = password && password.startsWith("GOOGLE_AUTH:");
  const googleEmailToken = isGoogleAuth ? password.substring(12).trim().toLowerCase() : "";
  const inputHash = isGoogleAuth ? "" : hashPassword(password);
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowUsername = row[0] ? row[0].toString().trim() : "";
    const storedPass = row[1] ? row[1].toString().trim() : "";
    const rowDisplayName = row[2] ? row[2].toString().trim() : rowUsername;
    const rowRole = row[3] ? row[3].toString().trim() : "EDITOR";
    const rowGoogleEmail = row[5] ? row[5].toString().trim().toLowerCase() : "";
    
    if (isGoogleAuth) {
      if ((rowUsername === username || (rowGoogleEmail && rowGoogleEmail === googleEmailToken)) && 
          (rowGoogleEmail === googleEmailToken || rowUsername.toLowerCase() === googleEmailToken)) {
        return {
          rowIndex: i + 1,
          username: rowUsername,
          displayName: rowDisplayName,
          role: rowRole,
          googleEmail: rowGoogleEmail
        };
      }
    } else {
      if (rowUsername === username) {
        if (storedPass === inputHash) {
          return {
            rowIndex: i + 1,
            username: rowUsername,
            displayName: rowDisplayName,
            role: rowRole,
            googleEmail: rowGoogleEmail
          };
        } else if (storedPass === password) {
          // Automatic migration from legacy plaintext password
          sheet.getRange(i + 1, 2).setValue(inputHash);
          return {
            rowIndex: i + 1,
            username: rowUsername,
            displayName: rowDisplayName,
            role: rowRole,
            googleEmail: rowGoogleEmail
          };
        }
      }
    }
  }
  return null;
}

// User Login Verification API (Username/Password)
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

// User Login Verification API (Google Account)
function verifyGoogleUser() {
  const userObj = getGoogleUser();
  const activeEmail = (userObj.email || "").trim().toLowerCase();

  if (!activeEmail) {
    return { success: false, message: "無法讀取您的 Google 帳號電郵，請確認您已登入 Google。" };
  }

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const username = row[0] ? row[0].toString().trim() : "";
    const displayName = row[2] ? row[2].toString().trim() : username;
    const role = row[3] ? row[3].toString().trim() : "EDITOR";
    const googleEmail = row[5] ? row[5].toString().trim().toLowerCase() : "";

    if ((googleEmail && googleEmail === activeEmail) || username.toLowerCase() === activeEmail) {
      return {
        success: true,
        user: {
          username: username,
          displayName: displayName,
          role: role,
          googleEmail: googleEmail || activeEmail
        },
        authKey: "GOOGLE_AUTH:" + activeEmail
      };
    }
  }

  return { success: false, message: `目前 Google 帳號 (${activeEmail}) 未經超級管理員授權登入後台。` };
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
      username: row[0] ? row[0].toString().trim() : "",
      displayName: row[2] ? row[2].toString().trim() : "",
      role: row[3] ? row[3].toString().trim() : "EDITOR",
      googleEmail: row[5] ? row[5].toString().trim() : ""
    });
  }
  return users;
}

function createUser(authUsername, authPassword, newUser) {
  const auth = authenticateUser(authUsername, authPassword);
  if (!auth || auth.role !== "SUPER_ADMIN") {
    return { success: false, message: "權限不足，僅超級管理員可建立帳號。" };
  }

  if (!newUser.username || !newUser.displayName || !newUser.role) {
    return { success: false, message: "請填寫必要欄位 (帳號、顯示姓名與角色)。" };
  }

  if (!newUser.password && !newUser.googleEmail) {
    return { success: false, message: "請至少設定密碼或綁定 Google 電郵。" };
  }

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const cleanUsername = newUser.username.trim();
  const cleanGoogle = newUser.googleEmail ? newUser.googleEmail.trim().toLowerCase() : "";

  for (let i = 1; i < data.length; i++) {
    const existingUsername = data[i][0] ? data[i][0].toString().trim().toLowerCase() : "";
    const existingGoogle = data[i][5] ? data[i][5].toString().trim().toLowerCase() : "";

    if (existingUsername === cleanUsername.toLowerCase()) {
      return { success: false, message: "此帳號已被使用！" };
    }
    if (cleanGoogle && existingGoogle === cleanGoogle) {
      return { success: false, message: "此 Google 電郵已被其他帳號綁定！" };
    }
  }

  const passHash = newUser.password && newUser.password.trim() ? hashPassword(newUser.password.trim()) : "";

  sheet.appendRow([
    cleanUsername,
    passHash,
    newUser.displayName.trim(),
    newUser.role.trim(),
    new Date(),
    cleanGoogle
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
    if (data[i][0] && data[i][0].toString().trim() === targetUsername) {
      if (updatedData.displayName) {
        sheet.getRange(i + 1, 3).setValue(updatedData.displayName.trim());
      }
      if (updatedData.role) {
        sheet.getRange(i + 1, 4).setValue(updatedData.role.trim());
      }
      if (updatedData.newPassword && updatedData.newPassword.trim() !== "") {
        sheet.getRange(i + 1, 2).setValue(hashPassword(updatedData.newPassword.trim()));
      }
      if (updatedData.googleEmail !== undefined) {
        sheet.getRange(i + 1, 6).setValue(updatedData.googleEmail.trim().toLowerCase());
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
    if (data[i][0] && data[i][0].toString().trim() === targetUsername) {
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
    equipment: DEFAULT_EQUIPMENT,
    positions: POSITIONS,
    autoApprovePositions: AUTO_APPROVE_POSITIONS
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
    const status = row[15] ? row[15].toString().trim() : "APPROVED";
    
    if (rowDate === queryDate && status !== "REJECTED" && status !== "已拒絕") {
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
        phone: row[12] || "",
        position: row[14] || "",
        status: status
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

    const status = row[15] ? row[15].toString().trim() : "APPROVED";

    if (d >= start && d <= end && status !== "REJECTED" && status !== "已拒絕") {
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
        phone: row[12] || "",
        position: row[14] || "",
        status: status
      });
    }
  }
  return bookings;
}

// ⚠️ Transmits email notifications using GmailApp - verify recipient email parameter before running
function sendBookingNotificationEmail(emailType, form, selectedRooms, finalNotes, rejectReason) {
  if (!form.email || !form.email.trim()) {
    throw new Error("無效的收件者電郵地址 (Recipient email address is missing)");
  }

  const recipient = form.email.trim();
  let subject = "";
  let headerTitle = "";
  let headerBg = "#2563eb";
  let statusBadge = "";

  if (emailType === "SUBMITTED") {
    subject = `【預約已提交 - 待審核】SHTPEC 房間與器材預訂通知 - ${form.activity}`;
    headerTitle = "🏛️ SHTPEC 房間預訂申請已接收 (待審核)";
    headerBg = "#2563eb";
    statusBadge = '<span style="background-color: #f59e0b; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold;">⏳ 待管理員審核 / Pending</span>';
  } else if (emailType === "APPROVED") {
    subject = `【預約成功確認】SHTPEC 房間與器材預訂 confirmation - ${form.activity}`;
    headerTitle = "✅ SHTPEC 房間預訂已成功批准";
    headerBg = "#16a34a";
    statusBadge = '<span style="background-color: #16a34a; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold;">✅ 已批准 / Approved</span>';
  } else if (emailType === "REJECTED") {
    subject = `【預約未獲批准通知】SHTPEC 房間與器材預訂結果 - ${form.activity}`;
    headerTitle = "❌ SHTPEC 房間預訂未獲批准通知";
    headerBg = "#dc2626";
    statusBadge = '<span style="background-color: #dc2626; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold;">❌ 已拒絕 / Rejected</span>';
  }

  let rejectReasonBlock = "";
  if (emailType === "REJECTED" && rejectReason) {
    rejectReasonBlock = `
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: bold; color: #991b1b; font-size: 14px;">拒絕原因 / Rejection Reason:</p>
        <p style="margin: 4px 0 0 0; color: #7f1d1d; font-size: 14px;">${escapeHtmlServer(rejectReason)}</p>
      </div>
    `;
  }

  const htmlBody = `
    <div style="font-family: Arial, 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff; color: #1e293b;">
      <div style="background-color: ${headerBg}; padding: 18px; border-radius: 8px; text-align: center; color: #ffffff; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 20px;">${headerTitle}</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">SHTPEC Room & Equipment Booking Receipt</p>
      </div>

      <p style="font-size: 15px; margin-bottom: 12px;">親愛的 <strong>${escapeHtmlServer(form.bookerName)}</strong> (${escapeHtmlServer(form.position || "預約者")})，您好！</p>
      
      <div style="margin-bottom: 16px;">
        審核狀態: ${statusBadge}
      </div>

      ${rejectReasonBlock}

      <p style="font-size: 14px; color: #475569; margin-bottom: 16px;">以下為您的預訂詳細紀錄：</p>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; width: 35%; color: #334155;">預訂日期 / Date</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${escapeHtmlServer(form.date)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">時段 / Timeslot</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${escapeHtmlServer(form.startTime)} - ${escapeHtmlServer(form.endTime)}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">預約房間 / Selected Rooms</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${escapeHtmlServer(selectedRooms.join(", "))}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">活動名稱 / Activity</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${escapeHtmlServer(form.activity)}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">部門 / Department</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${escapeHtmlServer(form.department || "-")}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">預約負責人 / Booker</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${escapeHtmlServer(form.bookerName)} (${escapeHtmlServer(form.position || "-")})</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">聯絡電話 / Phone</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${escapeHtmlServer(form.phone)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">器材需求與備註 / Notes</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${escapeHtmlServer(finalNotes || "無")}</td>
        </tr>
      </table>

      <div style="background-color: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px; color: #64748b;">
        📌 如需變更、查詢或協助，請聯繫系統管理員處理。
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">SHTPEC Room Booking System 自動發送郵件，請勿直接回覆。</p>
    </div>
  `;

  GmailApp.sendEmail(recipient, subject, `SHTPEC 房間預訂系統通知：${form.activity}`, {
    htmlBody: htmlBody,
    name: "SHTPEC Room Booking System"
  });
}

function escapeHtmlServer(string) {
  if (!string) return "";
  return String(string).replace(/[&<>"']/g, function(s) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s];
  });
}

function submitBooking(form) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_LOG);
    if (!sheet) throw new Error("找不到工作表: " + SHEET_LOG);
    
    if (!form.date || !form.startTime || !form.endTime || !form.bookerName || !form.phone || !form.email || !form.position) {
      return { success: false, message: "請填寫所有必填欄位 (日期、時間、預約者名稱、聯絡電話、電郵地址及崗位)。" };
    }

    // Process & Validate Custom Position Input (崗位其他必須輸入)
    let finalPosition = form.position ? form.position.trim() : "";
    const isOtherPosition = finalPosition.includes("其他") || finalPosition.includes("Other");
    if (isOtherPosition) {
      const customPos = form.customPosition ? form.customPosition.trim() : "";
      if (!customPos) {
        return { success: false, message: "當負責人崗位選擇「其他」時，必須輸入具體崗位名稱！" };
      }
      finalPosition = `其他: ${customPos}`;
    }

    // Process & Validate Custom Department Input (部門其他必須輸入)
    let finalDepartment = form.department ? form.department.trim() : "";
    const isOtherDept = finalDepartment === "其他" || finalDepartment.includes("Other");
    if (isOtherDept) {
      const customDept = form.customDepartment ? form.customDepartment.trim() : "";
      if (!customDept) {
        return { success: false, message: "當部門選擇「其他」時，必須輸入具體部門名稱！" };
      }
      finalDepartment = `其他: ${customDept}`;
    }
    
    const selectedRooms = form.selectedRooms || [];
    if (!Array.isArray(selectedRooms) || selectedRooms.length === 0) {
      return { success: false, message: "請至少選擇一個預訂房間。" };
    }
    
    if (form.startTime >= form.endTime) {
      return { success: false, message: "結束時間必須晚於開始時間。" };
    }

    // Auto-approval logic based on position:
    // 預設 團長 長執 傳道人 幹事 毋須批核 (APPROVED), 其他需要批核 (PENDING)
    const rawPos = form.position ? form.position.trim() : "";
    const isAutoApproved = AUTO_APPROVE_POSITIONS.includes(rawPos) && !isOtherPosition;
    const initialStatus = isAutoApproved ? "APPROVED" : "PENDING";
    
    const data = sheet.getDataRange().getValues();
    const newDateStr = new Date(form.date).toDateString();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const existingDateStr = row[0] instanceof Date ? row[0].toDateString() : new Date(row[0]).toDateString();
      const status = row[15] ? row[15].toString().trim() : "APPROVED";

      if (existingDateStr === newDateStr && status !== "REJECTED" && status !== "已拒絕") {
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

    // Append user email to notes for reference
    finalNotes = `[Email: ${form.email.trim()}] ${finalNotes}`.trim();

    const newRow = [
      form.date,
      form.startTime,
      form.endTime,
      rCols[0],
      rCols[1],
      rCols[2],
      rCols[3],
      rCols[4],
      finalDepartment,
      form.activity || "",
      finalNotes,
      form.bookerName,
      form.phone,
      new Date(),
      finalPosition,
      initialStatus,
      ""
    ];
    
    sheet.appendRow(newRow);

    // Send confirmation email
    const emailType = isAutoApproved ? "APPROVED" : "SUBMITTED";
    let emailSentSuccess = true;
    let emailErrMsg = "";
    try {
      const emailForm = Object.assign({}, form, {
        position: finalPosition,
        department: finalDepartment
      });
      sendBookingNotificationEmail(emailType, emailForm, selectedRooms, finalNotes, "");
    } catch (emailErr) {
      emailSentSuccess = false;
      emailErrMsg = emailErr.message;
      console.error("Confirmation email failed: " + emailErr.message);
    }

    const statusText = isAutoApproved 
      ? "預約成功！您的崗位 (團長/長執/傳道人/幹事) 毋須審核，預約已即時批准並生效。" 
      : "預約提交成功！您的崗位需要管理員批核，請靜候審核結果。";

    if (emailSentSuccess) {
      return { success: true, message: `${statusText} 確認電郵已發送至您的 Email。` };
    } else {
      return { success: true, message: `${statusText} 但通知電郵發送失敗 (${emailErrMsg})。` };
    }
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
      phone: row[12] || "",
      position: row[14] || "",
      status: row[15] || "APPROVED",
      rejectReason: row[16] || ""
    });
  }
  return list.reverse();
}

// Approve Booking (SUPER_ADMIN, ADMIN, EDITOR)
function approveBooking(username, password, rowIndex) {
  const user = authenticateUser(username, password);
  if (!user) {
    return { success: false, message: "未經授權的操作" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LOG);
  if (!sheet || rowIndex <= 1 || rowIndex > sheet.getLastRow()) {
    return { success: false, message: "找不到預訂紀錄" };
  }

  sheet.getRange(rowIndex, 16).setValue("APPROVED");
  sheet.getRange(rowIndex, 17).setValue("");

  // Send Approval Email
  const row = sheet.getRange(rowIndex, 1, 1, 17).getValues()[0];
  const notes = row[10] ? row[10].toString() : "";
  const emailMatch = notes.match(/\[Email:\s*([^\]]+)\]/);
  const userEmail = emailMatch ? emailMatch[1].trim() : "";

  const formPayload = {
    date: formatDate(row[0]),
    startTime: formatTime(row[1]),
    endTime: formatTime(row[2]),
    department: row[8] || "",
    activity: row[9] || "",
    bookerName: row[11] || "",
    phone: row[12] || "",
    position: row[14] || "",
    email: userEmail
  };

  let emailMsg = "";
  try {
    sendBookingNotificationEmail("APPROVED", formPayload, extractBookedRoomsFromRow(row), notes, "");
    emailMsg = "，並已成功發送批准通知郵件！";
  } catch (err) {
    console.error("Approval email error: " + err.message);
    emailMsg = "，但發送通知郵件失敗 (" + err.message + ")。";
  }

  return { success: true, message: "預約已成功批准" + emailMsg };
}

// Reject Booking (SUPER_ADMIN, ADMIN, EDITOR)
function rejectBooking(username, password, rowIndex, reason) {
  const user = authenticateUser(username, password);
  if (!user) {
    return { success: false, message: "未經授權的操作" };
  }

  if (!reason || !reason.trim()) {
    return { success: false, message: "請輸入拒絕原因。" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LOG);
  if (!sheet || rowIndex <= 1 || rowIndex > sheet.getLastRow()) {
    return { success: false, message: "找不到預訂紀錄" };
  }

  sheet.getRange(rowIndex, 16).setValue("REJECTED");
  sheet.getRange(rowIndex, 17).setValue(reason.trim());

  // Send Rejection Email
  const row = sheet.getRange(rowIndex, 1, 1, 17).getValues()[0];
  const notes = row[10] ? row[10].toString() : "";
  const emailMatch = notes.match(/\[Email:\s*([^\]]+)\]/);
  const userEmail = emailMatch ? emailMatch[1].trim() : "";

  const formPayload = {
    date: formatDate(row[0]),
    startTime: formatTime(row[1]),
    endTime: formatTime(row[2]),
    department: row[8] || "",
    activity: row[9] || "",
    bookerName: row[11] || "",
    phone: row[12] || "",
    position: row[14] || "",
    email: userEmail
  };

  let emailMsg = "";
  try {
    sendBookingNotificationEmail("REJECTED", formPayload, extractBookedRoomsFromRow(row), notes, reason.trim());
    emailMsg = "，並已發送拒絕原因通知郵件。";
  } catch (err) {
    console.error("Rejection email error: " + err.message);
    emailMsg = "，但發送拒絕電郵失敗 (" + err.message + ")。";
  }

  return { success: true, message: "預約已拒絕" + emailMsg };
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

  const existingRow = sheet.getRange(rowIndex, 1, 1, 17).getValues()[0];
  const existingNotes = existingRow[10] ? existingRow[10].toString() : "";
  const existingEmailMatch = existingNotes.match(/\[Email:\s*([^\]]+)\]/);

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
  if (eqList.length > 0 && !eqList.includes("毋須 any / None")) {
    eqParts.push(eqList.join(", "));
  }
  if (customEq) {
    eqParts.push(`自訂: ${customEq}`);
  }
  
  if (eqParts.length > 0 && !finalNotes.includes("[器材:")) {
    finalNotes = `[器材: ${eqParts.join(" | ")}] ${finalNotes}`.trim();
  }

  // Preserve existing [Email: ...] tag if present in notes
  if (existingEmailMatch && !finalNotes.includes("[Email:")) {
    finalNotes = `${existingEmailMatch[0]} ${finalNotes}`.trim();
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

  if (updatedForm.position) {
    sheet.getRange(rowIndex, 15).setValue(updatedForm.position);
  }

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
