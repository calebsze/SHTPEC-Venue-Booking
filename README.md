# SHTPEC Room Booking & Equipment Reservation System | 房間預訂與器材借用系統

---

## Language Navigation / 語言導航

* [English](https://www.google.com/search?q=%23english)
* [繁體中文 (Traditional Chinese)](https://www.google.com/search?q=%23%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-traditional-chinese)

---

## English

### 📖 Project Overview

The **SHTPEC Room Booking & Equipment Reservation System** is a lightweight, serverless full-stack web application designed for facilities management, room scheduling, and equipment checkout.

Powered by **Google Apps Script (GAS)** as the execution engine and **Google Sheets** as the real-time database, it delivers an intuitive user experience built with **Tailwind CSS** and dynamic client-side JavaScript.

The platform supports public self-service booking, dynamic calendar views, automated conflict detection, and an administrative portal backed by **Role-Based Access Control (RBAC)**.

---

### ✨ Key Features

#### 1. Public Portal & Booking Interface

* **12 Dedicated Rooms**: Multi-room selection covering Library, Room 2–5, Room A–D, Playground, Hall, and Public Area (2F).
* **Equipment Allocation**: Integrated borrowing checkboxes for sound systems, lighting, live-streaming devices, TVs, projectors, laptops (MacBook, Windows, Chromebook), plus custom equipment inputs.
* **Real-Time Conflict Prevention**: Validates incoming requests against active records to prevent overlapping schedules for any selected room.
* **Standardized Slots**: Pre-populated 30-minute intervals from 08:00 to 22:00.

#### 2. Live Multi-View Schedule Dashboard

* **Day View**: Time-matrix grid displaying room utilization and availability across all spaces.
* **Week View**: Mon-to-Sun 7-day breakdown of scheduled bookings.
* **Month View**: Traditional calendar view listing confirmed events per date.
* **Schedule / Agenda View**: Chronological booking stream displaying event titles, departments, booker contacts, and equipment requests.
* **Dark / Light Mode**: Dynamic theme switcher with automatic preference detection and `localStorage` persistence.

#### 3. Administrative Console (RBAC)

* **Tiered Permission Model**:
* `SUPER_ADMIN`: Comprehensive administrative rights, user provisioning, role assignments, and password resets.
* `ADMIN`: Manage, modify, and delete booking records; export logs.
* `EDITOR`: Update reservation schedules and audit activity.


* **Security Standards**:
* Passwords hashed using SHA-256 before storage.
* Environment credentials loaded securely via Apps Script `Script Properties` (`SUPER_ADMIN_PASSWORD`).
* Self-service password updates for authenticated users.


* **CSV Export Engine**: One-click download of reservation records formatted in UTF-8 with BOM for native compatibility with Microsoft Excel.

---

### 📂 File Structure

```text
├── .clasp.json          # Google Apps Script Clasp CLI configuration
├── appsscript.json      # Web app manifest, runtime, and timezone settings
├── Code.gs              # Server-side APIs, Sheets CRUD, lock services, and RBAC
├── Index.html           # Single-page UI, Tailwind styles, and frontend logic
└── README.md            # Comprehensive project documentation

```

---

### 🗄️ Database Architecture (Google Sheets)

The backend interfaces directly with three sheets:

#### 1. `Booking Log / 預約紀錄` (Primary Reservation Ledger)

| Column | Field Name | Description |
| --- | --- | --- |
| A (Col 1) | Date | Event date (`YYYY-MM-DD`) |
| B (Col 2) | Start Time | Event start time (`HH:mm`) |
| C (Col 3) | End Time | Event end time (`HH:mm`) |
| D – H (Col 4 – 8) | Rooms 1 to 5 | Booked room names (Excess rooms stored comma-separated in Col H) |
| I (Col 9) | Department | Affiliated group, fellowship, or department |
| J (Col 10) | Activity | Name or description of the event |
| K (Col 11) | Notes & Equipment | Additional notes appended with formatted tag `[器材: ...]` |
| L (Col 12) | Booker Name | Full name of contact person |
| M (Col 13) | Phone | Contact telephone number |
| N (Col 14) | Created At | Submission timestamp |

#### 2. `Users / 用戶管理` (User Accounts & Roles)

*Automatically generated upon first execution if not present.*

| Column | Field Name | Description |
| --- | --- | --- |
| A (Col 1) | Username | Unique administrative login name |
| B (Col 2) | Password | SHA-256 hashed password string |
| C (Col 3) | DisplayName | Display name of the user |
| D (Col 4) | Role | Permission level (`SUPER_ADMIN` / `ADMIN` / `EDITOR`) |
| E (Col 5) | CreatedAt | Account creation timestamp |

#### 3. `Setup - DO NOT EDIT` (Metadata Configuration - Optional)

* **Column C**: Populates options for the Department dropdown. Falls back to default fellowship/department lists if missing.

---

### ⚙️ Backend API Reference

| Function Name | Access Scope | Description |
| --- | --- | --- |
| `doGet()` | Public | Serves and renders `Index.html` with mobile viewport settings |
| `getSystemMeta()` | Public | Fetches available room lists, equipment definitions, and department items |
| `getScheduleByDate(targetDateStr)` | Public | Retrieves bookings for a single calendar date (Day View) |
| `getScheduleByDateRange(startStr, endStr)` | Public | Retrieves bookings across a date range (Week, Month, Agenda Views) |
| `submitBooking(form)` | Public | Validates room availability with `LockService` and writes new reservations |
| `verifyUser(username, password)` | Public / Auth | Authenticates credentials and resolves RBAC privileges |
| `changeOwnPassword(username, curPass, newPass)` | Authenticated | Allows active user to update account password |
| `getAdminBookings(username, password)` | Admin / Editor | Retrieves complete historical reservation list |
| `updateBooking(username, password, rowIndex, form)` | Admin / Editor | Updates schedule details and equipment allocations |
| `deleteBooking(username, password, rowIndex)` | Admin / Editor | Deletes a reservation record from the database |
| `getUsersList(username, password)` | Super Admin | Lists all user accounts and their assigned roles |
| `createUser(username, password, newUser)` | Super Admin | Registers a new user account with designated privileges |
| `updateUser(username, password, targetUser, data)` | Super Admin | Updates display name, permission tier, or resets account passwords |
| `deleteUser(username, password, targetUser)` | Super Admin | Removes a user profile from the database |

---

### 🚀 Setup & Deployment

#### Method A: Google Apps Script Web Editor

1. Create a new Google Spreadsheet on [Google Drive](https://drive.google.com/).
2. Navigate to **Extensions** > **Apps Script**.
3. Copy the contents of `Code.gs` and `Index.html` into their respective script files.
4. Enable the manifest file:
* Go to **Project Settings** (gear icon) > Check **Show "appsscript.json" manifest file in editor**.
* Paste the contents of `appsscript.json` and save.


5. **Set Super Admin Password**:
* Under **Project Settings**, scroll down to **Script Properties**.
* Click **Add script property**:
* **Property**: `SUPER_ADMIN_PASSWORD`
* **Value**: Your chosen root administrator password.




6. **Deploy the Web App**:
* Click **Deploy** > **New deployment**.
* Select type: **Web app**.
* Set **Execute as**: **Me**.
* Set **Who has access**: **Anyone** (or restricted domain users).
* Click **Deploy** and save the generated Web App URL.



#### Method B: Local Deployment via Google Clasp

1. Install and authenticate clasp:
```bash
npm install -g @google/clasp
clasp login

```


2. Clone repository and initialize the Apps Script project:
```bash
git clone https://github.com/your-username/shtpec-room-booking.git
cd shtpec-room-booking
clasp create --title "SHTPEC Room Booking" --type webapp
clasp push

```


3. Open the project settings to configure environment variables:
```bash
clasp open

```



---

## 繁體中文 (Traditional Chinese)

### 📖 專案概述 (Project Overview)

**SHTPEC 房間預訂與器材借用系統** 是一個輕量、無伺服器架構（Serverless）的全端 Web 應用程式。後端架構於 **Google Apps Script (GAS)**，資料庫直接串接 **Google Sheets**，前端使用現代化 **Tailwind CSS** 與響應式 JavaScript 建構。

系統專為機構、學校或團契設計，提供前台公開預約與多視角即時日程看板，並配備基於角色訪問控制（RBAC）的專業後台管理系統，可防止時段重疊衝突，並支援器材借用管理與資料匯出。

---

### ✨ 核心功能 (Key Features)

#### 1. 前台公開預約 (Public Portal)

* **12 間獨立房間選擇**：支援多選房間預約（涵蓋圖書房、二至五號房、A-D 房、禮堂、遊樂場及中庭等）。
* **多樣化器材借用**：可預訂音響、燈光、直播器材、投影機、手提電腦，並支援輸入自訂器材需求。
* **即時衝突校驗**：提交預約時自動檢測同日期的時間重疊衝突，杜絕重複預訂。
* **高相容性日曆元件**：自動生成 30 分鐘為單位的時段選項（08:00 – 22:00）。

#### 2. 即時日程看板 (Live Schedule Dashboard)

* **日視角 (Day View)**：格狀矩陣呈現各時段各房間的使用情況與可用狀態。
* **週視角 (Week View)**：週一至週日的 7 日概覽，清晰掌握整週活動。
* **月視角 (Month View)**：月曆方格檢視每日預約清單。
* **日程列表 (Agenda / Schedule View)**：以時間軸清單逐條羅列活動、預約者及器材備註。
* **快捷切換與深色模式**：支援一鍵跳轉今日、前後日/週/月切換，以及支援深色（Dark Mode）/ 淺色模式切換。

#### 3. 角色權限管理後台 (RBAC Admin Console)

* **分級權限控制**：
* `SUPER_ADMIN`（超級管理員）：全權管理預約行程、匯出 CSV、建立/修改/刪除管理員帳號、重設所有密碼。
* `ADMIN`（普通管理員）：管理、修改與取消現有預約、匯出報表。
* `EDITOR`（行程編輯者）：修改與檢視預約資料。


* **安全機制**：
* 支援密碼 SHA-256 加密存儲。
* 支援透過 Google Apps Script `Script Properties` 配置初始化環境變數。
* 支援所有已登入管理員自行修改個人密碼。


* **資料導出**：支援一鍵匯出 UTF-8 附帶 BOM 的 CSV 格式預約紀錄（相容 Excel 繁體中文開啟不亂碼）。

---

### 📂 檔案目錄結構 (Project Structure)

```text
├── .clasp.json          # Google Apps Script clasp 專案設定檔
├── appsscript.json      # Apps Script 清單設定檔 (Manifest)
├── Code.gs              # 後端商業邏輯、Google Sheets API 操作、RBAC 驗證與衝突檢驗
├── Index.html           # 前端 UI、Tailwind CSS、日/週/月/列表渲染與非同步 RPC 調用
└── README.md            # 專案詳細說明文件 (雙語版本)

```

---

### 🗄️ Google Sheets 資料庫設計 (Database Schema)

本系統依賴於試算表中的三個工作表（Tabs）：

#### 1. `Booking Log / 預約紀錄` (主紀錄表)

| 欄位序號 | 欄位名稱 | 說明 |
| --- | --- | --- |
| A (Col 1) | 日期 | 預約日期 (格式: `YYYY-MM-DD`) |
| B (Col 2) | 開始時間 | 預約開始時間 (格式: `HH:mm`) |
| C (Col 3) | 結束時間 | 預約結束時間 (格式: `HH:mm`) |
| D - H (Col 4 - 8) | 房間 1 至 5 | 預訂之房間名稱（若超過 5 間會收錄於第 H 欄） |
| I (Col 9) | 部門 | 所屬部門或團契團契名稱 |
| J (Col 10) | 活動名稱 | 預訂活動之主旨或名稱 |
| K (Col 11) | 備註與器材 | 自訂說明及系統整合之器材清單字串 `[器材: ...]` |
| L (Col 12) | 預約者姓名 | 聯絡人姓名 |
| M (Col 13) | 聯絡電話 | 聯絡人電話 |
| N (Col 14) | 提交時間 | 系統新增此筆資料之時間戳記 |

#### 2. `Users / 用戶管理` (帳號權限表)

*若工作表不存在，系統會在初次執行時自動生成此表及初始超級管理員。*

| 欄位序號 | 欄位名稱 | 說明 |
| --- | --- | --- |
| A (Col 1) | Username | 帳號名稱 (唯一值) |
| B (Col 2) | Password | SHA-256 密碼雜湊值 |
| C (Col 3) | DisplayName | 顯示姓名 |
| D (Col 4) | Role | 角色 (`SUPER_ADMIN` / `ADMIN` / `EDITOR`) |
| E (Col 5) | CreatedAt | 建立時間戳記 |

#### 3. `Setup - DO NOT EDIT` (系統設定表 - 選填)

* **C 欄 (第 3 欄)**：可設定下拉式選單之「部門」清單；若無此工作表，系統將載入預設部門選項。

---

### ⚙️ 後端 API 函式一覽 (Backend API Reference)

| 函式名稱 | 權限需求 | 說明 |
| --- | --- | --- |
| `doGet()` | 公開 | 網頁應用程式入口點，評估並渲染 `Index.html` |
| `getSystemMeta()` | 公開 | 獲取可用房間清單、器材項目及部門選項 |
| `getScheduleByDate(targetDateStr)` | 公開 | 檢索指定單日的所有預約資料（日視角使用） |
| `getScheduleByDateRange(startStr, endStr)` | 公開 | 檢索跨日期區間預約（週、月、列表視角使用） |
| `submitBooking(form)` | 公開 | 執行衝突檢查並將預約資料寫入 Google Sheets（具腳本鎖 LockService） |
| `verifyUser(username, password)` | 登入 | 驗證後台帳號密碼並回傳角色權限 |
| `changeOwnPassword(username, curPass, newPass)` | 已登入者 | 變更目前使用者的登入密碼 |
| `getAdminBookings(username, password)` | 管理員/編輯者 | 檢索所有歷史預約紀錄 |
| `updateBooking(username, password, rowIndex, form)` | 管理員/編輯者 | 修改現有預約之內容與借用項目 |
| `deleteBooking(username, password, rowIndex)` | 管理員/編輯者 | 刪除/取消指定的預約紀錄 |
| `getUsersList(username, password)` | SUPER_ADMIN | 檢索所有管理員帳號與其權限清單 |
| `createUser(username, password, newUser)` | SUPER_ADMIN | 建立全新管理員帳號與分配權限 |
| `updateUser(username, password, targetUser, data)` | SUPER_ADMIN | 變更指定帳號之權限、顯示姓名或重設密碼 |
| `deleteUser(username, password, targetUser)` | SUPER_ADMIN | 刪除指定之管理員帳號 |

---

### 🚀 安裝與部署指南 (Deployment Guide)

#### 方法 A：使用 Google Apps Script 線上編輯器

1. 前往 [Google Drive](https://drive.google.com/) 並新建一個 Google Sheets 試算表。
2. 點擊頂部功能表的 **擴充功能 (Extensions)** > **Apps Script**。
3. 將儲存庫中的 `Code.gs` 與 `Index.html` 內容複製貼入編輯器中。
4. 設定清單檔：
* 點擊左側「專案設定」(齒輪圖示) > 勾選「在編輯器中顯示 "appsscript.json" 資訊清單檔案」。
* 將本專案的 `appsscript.json` 內容貼入並存檔。


5. **設定初始超級管理員密碼**：
* 於「專案設定」頁面下方找到「指令碼屬性」(Script Properties)。
* 新增屬性：名稱為 `SUPER_ADMIN_PASSWORD`，值為您自訂的安全密碼。


6. **發佈為 Web 應用程式**：
* 點擊右上角 **部署 (Deploy)** > **新增部署 (New deployment)**。
* 選擇類型：**網頁應用程式 (Web app)**。
* 執行身分 (Execute as)：**我 (Me)**。
* 誰可以存取 (Who has access)：**任何人 (Anyone)** 或機構內部成員。
* 點擊「部署」並複製產生的網頁應用程式網址。



#### 方法 B：使用 Google Clasp 本地開發工具

1. 安裝 clasp：
```bash
npm install -g @google/clasp
clasp login

```


2. 複製專案並推送至 Apps Script：
```bash
git clone https://github.com/your-username/shtpec-room-booking.git
cd shtpec-room-booking
clasp create --title "SHTPEC Room Booking" --type webapp
clasp push

```


3. 在瀏覽器中開啟專案設定環境變數：
```bash
clasp open

```



---

## 📄 License

This project is open-source and distributed under the [MIT License](https://www.google.com/search?q=LICENSE).
