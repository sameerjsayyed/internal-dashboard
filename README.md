# 🕒 Time Booking Dashboard

An internal web application for managing time bookings, revenue calculations, and contract-task-based reporting. Built using **Angular 19 (Material MDC)** for the frontend and **FastAPI (Python)** for the backend, with SQLite and Excel integration.

---

## 🚀 Features

### ✅ Excel Upload (Frontend + Backend)
- Upload `.xls` or `.xlsx` time booking reports
- Auto-detects sheet and headers
- Parses `Booked Hours`, `Time Booking Date`, etc.

### ✅ Report Views
- Task-wise, Resource-wise, Consolidated
- Includes row-wise and column-wise totals
- Excel export for all reports

### ✅ Revenue Calculation
- Revenue = Booked Hours × RPH (Rate Per Hour)
- Views:
  - Task-wise (with Booked Hours)
  - Contract-wise
  - Month-wise (pivoted, e.g., Apr-2025, May-2025)
  - Quarter-wise (e.g., Q1 (Apr-Jun) 2025)

### ✅ RPH Maintenance Module
- UI to add/update/delete RPH values
- Excel upload support
- Highlights updated rows
- No flicker or focus loss on edits

### ✅ Filtering and Search
- Multi-select filters: Contract Code, Task Code
- Dynamic filtering with row/column totals preserved

### ✅ UX / Styling
- PwC brand colors
- Drag-and-drop Excel upload
- Animated table highlights
- Sticky totals, search, and headers

---

## 🧱 Tech Stack

| Layer     | Technology        |
|-----------|-------------------|
| Frontend  | Angular 19 (MDC)  |
| Backend   | FastAPI (Python 3.12) |
| Database  | SQLite            |
| Excel     | Pandas + OpenPyXL |
| Styling   | SCSS + Angular Material |
| Charts/UI | Angular Material Tabs, Tables, Forms |

---

## 📦 Backend API Endpoints

### Upload & History
- `POST /upload` – Upload Excel file
- `GET /history` – List previous uploads
- `GET /history/latest` – Get latest file metadata
- `GET /history/{id}` – Get parsed report for upload
- `DELETE /history/{id}` – Delete upload

### RPH Management
- `GET /rph` – List RPH rows
- `POST /rph` – Add RPH in bulk
- `PUT /rph/{id}` – Update RPH
- `DELETE /rph/{id}` – Delete RPH

### Revenue Reports
- `GET /revenue/latest` – Revenue for latest upload
- `GET /revenue/{id}` – Revenue for any uploaded report

---

## 🛠 Setup Instructions

### 📦 Backend

```bash
cd backend/
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 🌐 Frontend

```bash
cd frontend/
npm install
ng serve
```

Access via: `http://localhost:4200`

---

## 📁 Folder Structure

```
backend/
  ├── main.py
  ├── parser.py
  ├── models.py
  ├── rph_models.py
  ├── upload_history.db
frontend/
  ├── src/app/
      ├── upload/
      ├── reports/
      ├── revenue-report/
      ├── rph-maintenance/
```

---

## ✨ Future Ideas

- ChatGPT integration for “Explain this report”
- PDF export for revenue summaries
- Contract-level tagging and approval workflows

---

## 📬 Maintainer

Developed by Sameer @ PwC India