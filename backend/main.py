import pandas as pd, io
import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Path, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, create_engine, select, delete
from models import UploadHistory
from rph_models import RPHMaster, RPHMasterCreate
from datetime import datetime
import pytz

from parser import parse_raw_excel, build_reports   # keep logic isolated

app = FastAPI(title="Timebooking API")
engine = create_engine("sqlite:///upload_history.db")
SQLModel.metadata.create_all(engine)

# CORS for Angular dev server (:4200)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def ensure_merge_column_types(rph_df: pd.DataFrame) -> pd.DataFrame:
    """Ensure merge columns are strings for consistent merging"""
    rph_df = rph_df.copy()
    rph_df['contract_code'] = rph_df['contract_code'].astype(str)
    rph_df['task_code'] = rph_df['task_code'].astype(str)
    return rph_df

def get_quarter_label(date: pd.Timestamp) -> str:
    month = date.month
    year = date.year
    if month in [1, 2, 3]:
        return f"Q4 (Jan-Mar) {year-1}"
    elif month in [4, 5, 6]:
        return f"Q1 (Apr-Jun) {year}"
    elif month in [7, 8, 9]:
        return f"Q2 (Jul-Sep) {year}"
    else:
        return f"Q3 (Oct-Dec) {year}"


label_col_map = {
    "Month": lambda d: d.strftime("%b-%Y"),
    "Quarter": get_quarter_label
}


def pivot_by_period(df: pd.DataFrame, date_col: str, label_col: str) -> pd.DataFrame:
    df[label_col] = df[date_col].apply(label_col_map[label_col])
    pivot = df.pivot_table(
        index=["Contract Number"],
        columns=label_col,
        values="Revenue",
        aggfunc="sum",
        fill_value=0
    ).reset_index()

    fixed = ["Contract Number"]
    period_cols = sorted(
        [c for c in pivot.columns if c not in fixed],
        key=lambda c: datetime.strptime(c.split("-")[0], "%b") if label_col == "Month" else c
    )

    return pivot[fixed + period_cols]


def generate_revenue_response(df: pd.DataFrame) -> dict:
    try:
        # print(f"generate_revenue_response - DataFrame columns: {list(df.columns)}")
        # print(f"generate_revenue_response - DataFrame shape: {df.shape}")
        # print(f"generate_revenue_response - Sample data: {df.head(2).to_dict('records')}")
        
        task_revenue = df.groupby(["Contract Number", "Project Description", "Task Number", "Task Name"])[["Revenue", "Booked Hours"]].sum().reset_index()
        contract_revenue = df.groupby("Contract Number")["Revenue"].sum().reset_index()
        month_revenue = pivot_by_period(df.copy(), "Time Booking Date", "Month")
        quarter_revenue = pivot_by_period(df.copy(), "Time Booking Date", "Quarter")

        # Add contract_name column to pivots
        contract_names = df.groupby("Contract Number")["Project Description"].first().to_dict()

        contract_revenue["Project Description"] = contract_revenue["Contract Number"].map(contract_names)
        month_revenue["Project Description"] = month_revenue["Contract Number"].map(contract_names)
        quarter_revenue["Project Description"] = quarter_revenue["Contract Number"].map(contract_names)

        # Reorder so that contract_name comes right after contract code
        def reorder(df):
            cols = list(df.columns)
            if "Project Description" in cols and "Contract Number" in cols:
                cols.insert(cols.index("Contract Number") + 1, cols.pop(cols.index("Project Description")))
            return df[cols]

        contract_revenue = reorder(contract_revenue)
        month_revenue = reorder(month_revenue)
        quarter_revenue = reorder(quarter_revenue)

        def to_report(d: pd.DataFrame):
            return {
                "columns": list(d.columns),
                "data": d.to_dict(orient="records")
            }

        return {
            "taskWiseRevenue": to_report(task_revenue),
            "contractWiseRevenue": to_report(contract_revenue),
            "monthlyRevenue": to_report(month_revenue),
            "quarterlyRevenue": to_report(quarterly_revenue)
        }
    except Exception as e:
        print(f"Error in generate_revenue_response: {str(e)}")
        raise



@app.post("/upload")
async def upload_excel(file: UploadFile = File(...)):
    if not (file.filename.lower().endswith(".xls") or file.filename.lower().endswith(".xlsx")):
        raise HTTPException(400, "Only .xls or .xlsx files are allowed")

    content = await file.read()
    df = parse_raw_excel(io.BytesIO(content), file.filename)
    reports = build_reports(df)

    def df_to_dict(d: pd.DataFrame):
        return {
            "columns": list(d.columns),
            "data": d.to_dict(orient="records"),
        }

    # Save upload metadata + load RPH
    with Session(engine) as session:
        rph_rows = session.exec(select(RPHMaster)).all()
        rph_df = pd.DataFrame([{
            "contract_code": r.contract_code,
            "contract_name": r.contract_name,
            "task_code": r.task_code,
            "rph": r.rph
        } for r in rph_rows])
        rph_df = ensure_merge_column_types(rph_df)

        # Debug merge column data types for upload endpoint
        # print(f"Upload - Main DataFrame Contract Number type: {df['Contract Number'].dtype}")
        # print(f"Upload - Main DataFrame Task Number type: {df['Task Number'].dtype}")
        # print(f"Upload - RPH DataFrame contract_code type: {rph_df['contract_code'].dtype}")
        # print(f"Upload - RPH DataFrame task_code type: {rph_df['task_code'].dtype}")

        record = UploadHistory(
            file_name=file.filename,
            file_size_kb=len(content) // 1024,
        )
        session.add(record)
        session.commit()
        session.refresh(record)

        # Save file for future parsing
        save_path = os.path.join(UPLOAD_DIR, f"{record.id}_{file.filename}")
        with open(save_path, "wb") as f:
            f.write(content)

    # Join and compute revenue
    merged = df.merge(
        rph_df,
        how="left",
        left_on=["Contract Number", "Task Number"],
        right_on=["contract_code", "task_code"]
    )
    # Use Project Description for contract name
    merged["Project Description"] = merged["Project Description"].fillna("")
    merged["Revenue"] = merged["Booked Hours"] * merged["rph"]

    # Revenue reports
    def to_report(df: pd.DataFrame):
        return {
            "columns": list(df.columns),
            "data": df.to_dict(orient="records")
        }

    task_revenue = merged.groupby(["Contract Number", "Task Number"])["Revenue"].sum().reset_index()
    contract_revenue = merged.groupby("Contract Number")["Revenue"].sum().reset_index()
    month_revenue = merged.groupby(["Contract Number", "Month"])["Revenue"].sum().reset_index()

    merged["Quarter"] = merged["Time Booking Date"].dt.to_period("Q").astype(str)
    quarterly_revenue = merged.groupby(["Contract Number", "Quarter"])["Revenue"].sum().reset_index()

    return {
        "generatedAt": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat() + "Z",
        "taskWise": df_to_dict(reports["taskWise"]),
        "resourceWise": df_to_dict(reports["resourceWise"]),
        "consolidated": df_to_dict(reports["consolidated"]),
        "revenue": {
            "taskWiseRevenue": to_report(task_revenue),
            "contractWiseRevenue": to_report(contract_revenue),
            "monthlyRevenue": to_report(month_revenue),
            "quarterlyRevenue": to_report(quarterly_revenue),
        }
    }

@app.get("/history", response_model=list[UploadHistory])
def get_history():
    with Session(engine) as session:
        results = session.exec(select(UploadHistory).order_by(UploadHistory.uploaded_at.desc())).all()
        return results

@app.get("/history/latest")
def latest_upload():
    with Session(engine) as session:
        return session.exec(select(UploadHistory).order_by(UploadHistory.uploaded_at.desc())).first()

@app.get("/history/{record_id}")
def get_upload_report(record_id: int):
    with Session(engine) as session:
        record = session.get(UploadHistory, record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")

    file_path = os.path.join(UPLOAD_DIR, f"{record.id}_{record.file_name}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Saved Excel file not found")

    try:
        with open(file_path, "rb") as f:
            df = parse_raw_excel(f, record.file_name)
        reports = build_reports(df)
        # RPH join + Revenue calculation
        with Session(engine) as session:
            rph_rows = session.exec(select(RPHMaster)).all()
            rph_df = pd.DataFrame([{
                "contract_code": r.contract_code,
                "contract_name": r.contract_name,
                "task_code": r.task_code,
                "rph": r.rph
            } for r in rph_rows])
            rph_df = ensure_merge_column_types(rph_df)

        # Debug merge column data types
        # print(f"Main DataFrame Contract Number type: {df['Contract Number'].dtype}")
        # print(f"Main DataFrame Task Number type: {df['Task Number'].dtype}")
        # print(f"RPH DataFrame contract_code type: {rph_df['contract_code'].dtype}")
        # print(f"RPH DataFrame task_code type: {rph_df['task_code'].dtype}")
        # print(f"Sample Contract Numbers from main: {df['Contract Number'].head().tolist()}")
        # print(f"Sample contract_codes from RPH: {rph_df['contract_code'].head().tolist()}")

        merged = df.merge(
            rph_df,
            how="left",
            left_on=["Contract Number", "Task Number"],
            right_on=["contract_code", "task_code"]
        )
        # print(f"Merge completed. Merged DataFrame shape: {merged.shape}")
        # print(f"Merged DataFrame columns: {list(merged.columns)}")
        # print(f"Sample merged data: {merged.head(2).to_dict('records')}")
        
        merged["Revenue"] = merged["Booked Hours"] * merged["rph"]
        # print(f"Revenue calculation completed. Sample Revenue values: {merged['Revenue'].head().tolist()}")

        def to_report(d: pd.DataFrame):
            return {
                "columns": list(d.columns),
                "data": d.to_dict(orient="records")
            }

        task_revenue = merged.groupby(["Contract Number", "Task Number"])["Revenue"].sum().reset_index()
        contract_revenue = merged.groupby("Contract Number")["Revenue"].sum().reset_index()
        month_revenue = merged.groupby(["Contract Number", "Month"])["Revenue"].sum().reset_index()
        merged["Quarter"] = merged["Time Booking Date"].dt.to_period("Q").astype(str)
        quarterly_revenue = merged.groupby(["Contract Number", "Quarter"])["Revenue"].sum().reset_index()

        def df_to_dict(d: pd.DataFrame):
            return {
                "columns": list(d.columns),
                "data": d.to_dict(orient="records"),
            }

        return {
            "id": record.id,
            "file_name": record.file_name,
            "file_size_kb": record.file_size_kb,
            "uploaded_at": record.uploaded_at,
            "taskWise": df_to_dict(reports["taskWise"]),
            "resourceWise": df_to_dict(reports["resourceWise"]),
            "consolidated": df_to_dict(reports["consolidated"]),
            "revenue": {
                "taskWiseRevenue": to_report(task_revenue),
                "contractWiseRevenue": to_report(contract_revenue),
                "monthlyRevenue": to_report(month_revenue),
                "quarterlyRevenue": to_report(quarterly_revenue),
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse report: {str(e)}")


@app.delete("/history/{record_id}")
def delete_record(record_id: int):
    with Session(engine) as session:
        record = session.get(UploadHistory, record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")
        session.delete(record)
        session.commit()
        return {"deleted": True}

@app.delete("/history")
def clear_history():
    with Session(engine) as session:
        session.exec(delete(UploadHistory))
        session.commit()
        return {"cleared": True}

####### RPH ######
@app.get("/rph", response_model=list[RPHMaster])
def list_rph():
    with Session(engine) as session:
        return session.exec(select(RPHMaster)).all()

@app.post("/rph", response_model=list[RPHMaster])
def add_rph(rows: list[RPHMasterCreate]):
    with Session(engine) as session:
        inserted = []

        for row in rows:
            exists = session.exec(
                select(RPHMaster).where(
                    RPHMaster.contract_code == row.contract_code,
                    RPHMaster.task_code == row.task_code
                )
            ).first()

            if not exists:
                entry = RPHMaster(**row.dict())
                session.add(entry)
                inserted.append(entry)

        session.commit()
        return inserted

@app.put("/rph/{rph_id}", response_model=RPHMaster)
def update_rph(rph_id: int, data: RPHMasterCreate):
    with Session(engine) as session:
        row = session.get(RPHMaster, rph_id)
        if not row:
            raise HTTPException(status_code=404, detail="RPH record not found")
        for field, value in data.dict().items():
            setattr(row, field, value)
        session.add(row)
        session.commit()
        return row

@app.delete("/rph/{rph_id}")
def delete_rph(rph_id: int):
    with Session(engine) as session:
        row = session.get(RPHMaster, rph_id)
        if not row:
            raise HTTPException(status_code=404, detail="RPH record not found")
        session.delete(row)
        session.commit()
        return {"deleted": True}

##### REVENUE ####
@app.get("/revenue/latest")
def get_latest_revenue():
    with Session(engine) as session:
        record = session.exec(select(UploadHistory).order_by(UploadHistory.uploaded_at.desc())).first()
        if not record:
            raise HTTPException(status_code=404, detail="No uploads found")

    file_path = os.path.join(UPLOAD_DIR, f"{record.id}_{record.file_name}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Saved Excel file not found")

    try:
        with open(file_path, "rb") as f:
            df = parse_raw_excel(f, record.file_name)

        with Session(engine) as session:
            rph_rows = session.exec(select(RPHMaster)).all()
            rph_df = pd.DataFrame([{
                "contract_code": r.contract_code,
                "contract_name": r.contract_name,
                "task_code": r.task_code,
                "rph": r.rph
            } for r in rph_rows])
            rph_df = ensure_merge_column_types(rph_df)

        # Debug merge column data types for revenue/latest
        # print(f"Revenue/Latest - Main DataFrame Contract Number type: {df['Contract Number'].dtype}")
        # print(f"Revenue/Latest - Main DataFrame Task Number type: {df['Task Number'].dtype}")
        # print(f"Revenue/Latest - RPH DataFrame contract_code type: {rph_df['contract_code'].dtype}")
        # print(f"Revenue/Latest - RPH DataFrame task_code type: {rph_df['task_code'].dtype}")

        merged = df.merge(
            rph_df,
            how="left",
            left_on=["Contract Number", "Task Number"],
            right_on=["contract_code", "task_code"]
        )
        merged["Revenue"] = merged["Booked Hours"] * merged["rph"]

        return generate_revenue_response(merged)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate revenue: {str(e)}")

@app.get("/revenue/{record_id}")
def get_revenue_by_id(record_id: int):
    with Session(engine) as session:
        record = session.get(UploadHistory, record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Upload not found")

    file_path = os.path.join(UPLOAD_DIR, f"{record.id}_{record.file_name}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Saved Excel file not found")

    try:
        with open(file_path, "rb") as f:
            df = parse_raw_excel(f, record.file_name)

        with Session(engine) as session:
            rph_rows = session.exec(select(RPHMaster)).all()
            rph_df = pd.DataFrame([{
                "contract_code": r.contract_code,
                "contract_name": r.contract_name,
                "task_code": r.task_code,
                "rph": r.rph
            } for r in rph_rows])
            rph_df = ensure_merge_column_types(rph_df)

        # Debug merge column data types for revenue/{record_id}
        # print(f"Revenue/Record - Main DataFrame Contract Number type: {df['Contract Number'].dtype}")
        # print(f"Revenue/Record - Main DataFrame Task Number type: {df['Task Number'].dtype}")
        # print(f"Revenue/Record - RPH DataFrame contract_code type: {rph_df['contract_code'].dtype}")
        # print(f"Revenue/Record - RPH DataFrame task_code type: {rph_df['task_code'].dtype}")

        merged = df.merge(
            rph_df,
            how="left",
            left_on=["Contract Number", "Task Number"],
            right_on=["contract_code", "task_code"]
        )
        merged["Revenue"] = merged["Booked Hours"] * merged["rph"]

        return generate_revenue_response(merged)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate revenue: {str(e)}")
