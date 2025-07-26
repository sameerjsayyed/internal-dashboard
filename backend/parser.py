import pandas as pd
import os
from datetime import datetime

PROJECT_DESCRIPTION = "Project Description"
TASK_NAME = "Task Name"
CONTRACT_NAME = "Contract Name"  # Deprecated, use PROJECT_DESCRIPTION
TASK_NUMBER_COL = "Task Number"
CONTRACT_NUMBER_COL = "Contract Number"
TIME_BOOKING_DATE_COL = "Time Booking Date"
BOOKED_HOURS_COL = "Booked Hours"

HEADER_FIRST, HEADER_LAST = "Entity", "Staff Criteria"
SHEET_NAME      = "Time Booking Report"
DATE_FMT        = "%d-%b-%Y"
STAFF_COL       = "Staff Name"
MONTH_FMT       = "%b-%Y"              # 'Jul-2025'

def find_header_row(df: pd.DataFrame) -> int:
    for i, row in df.iterrows():
        if str(row.iloc[0]).strip() == HEADER_FIRST and \
           str(row.iloc[row.last_valid_index()]).strip() == HEADER_LAST:
            return i
    raise ValueError("Header row not found")

def parse_raw_excel(file_buffer, filename: str) -> pd.DataFrame:
    ext = os.path.splitext(filename)[1].lower()
    engine = "xlrd" if ext == ".xls" else "openpyxl"

    # Step 1: Load all sheet names
    all_sheets = pd.ExcelFile(file_buffer, engine=engine).sheet_names

    # Step 2: Prefer "Time Booking Report", fallback to first
    target_sheet = SHEET_NAME if SHEET_NAME in all_sheets else all_sheets[0]
    if SHEET_NAME not in all_sheets:
        print(f"⚠ Sheet '{SHEET_NAME}' not found. Using '{target_sheet}' instead.")

    # Step 3: Sniff header
    sniff = pd.read_excel(file_buffer, sheet_name=target_sheet, header=None, nrows=20, engine=engine)
    header_row = find_header_row(sniff)

    df = pd.read_excel(
        file_buffer,
        sheet_name=SHEET_NAME,
        header=None,
        skiprows=header_row + 1,
        engine="xlrd",
        dtype=str,
    )
    df.columns = sniff.iloc[header_row].str.strip().tolist()[: df.shape[1]]

    # Use Project Description as contract name
    if PROJECT_DESCRIPTION in df.columns:
        df[PROJECT_DESCRIPTION] = df[PROJECT_DESCRIPTION].fillna("").astype(str)
    else:
        df[PROJECT_DESCRIPTION] = ""
    df[TASK_NAME] = df[TASK_NAME].fillna("").astype(str)
    df[BOOKED_HOURS_COL]      = pd.to_numeric(df[BOOKED_HOURS_COL], errors="coerce").fillna(0)
    df[TIME_BOOKING_DATE_COL] = pd.to_datetime(df[TIME_BOOKING_DATE_COL], format=DATE_FMT, errors="coerce")
    df["Month"]             = df[TIME_BOOKING_DATE_COL].dt.strftime(MONTH_FMT)
    df["Week"]              = "W" + df[TIME_BOOKING_DATE_COL].dt.isocalendar().week.astype(str).str.zfill(2)
    return df

def build_reports(df: pd.DataFrame):
    # Use Project Description for pivots
    task_df = (df
        .pivot_table(index=[CONTRACT_NUMBER_COL, PROJECT_DESCRIPTION, TASK_NUMBER_COL, TASK_NAME],
                     columns="Month",
                     values=BOOKED_HOURS_COL,
                     aggfunc="sum",
                     fill_value=0)
        .reset_index())

    resource_df = (df
        .pivot_table(index=[STAFF_COL, CONTRACT_NUMBER_COL, PROJECT_DESCRIPTION, TASK_NUMBER_COL, TASK_NAME],
                     columns="Month",
                     values=BOOKED_HOURS_COL,
                     aggfunc="sum",
                     fill_value=0)
        .reset_index())

    consolidated_df = (df
        .pivot_table(index=[CONTRACT_NUMBER_COL, PROJECT_DESCRIPTION, TASK_NUMBER_COL, TASK_NAME, STAFF_COL],
                     columns="Month",
                     values=BOOKED_HOURS_COL,
                     aggfunc="sum",
                     fill_value=0)
        .reset_index())

    # Week-wise pivot (flattened)
    base = (
        df.pivot_table(
            index=[CONTRACT_NUMBER_COL, PROJECT_DESCRIPTION, TASK_NUMBER_COL, TASK_NAME, STAFF_COL],
            columns=["Month", "Week"],
            values=BOOKED_HOURS_COL,
            aggfunc="sum",
            fill_value=0
        )
        .reset_index()
    )

    base.columns = [
        f"{c[0]}|{c[1]}" if isinstance(c, tuple) else c
        for c in base.columns
    ]

    # Group weeks under each month
    month_week_map = {}
    for col in base.columns:
        if "|" in col:
            month, week = col.split("|")
            if month and week:
                month_week_map.setdefault(month, []).append(week)

    def week_sort(w):
        try:
            return int(w[1:]) if w and w.startswith('W') and len(w) > 1 else 999
        except:
            return 999

    for m in month_week_map:
        month_week_map[m].sort(key=week_sort)

    # Ensure month-only columns are sorted too
    return {
        "taskWise": sort_month_columns(task_df),
        "resourceWise": sort_month_columns(resource_df),
        "consolidated": sort_month_columns(consolidated_df),
        "columns": list(base.columns),
        "data": base.to_dict(orient="records")
    }


def sort_month_columns(df: pd.DataFrame) -> pd.DataFrame:
    # Identify which columns are month columns (format: Apr-2025, May-2025, etc.)
    def is_month_col(col):
        try:
            datetime.strptime(col, "%b-%Y")
            return True
        except:
            return False

    fixed_cols = [col for col in df.columns if not is_month_col(col)]
    month_cols = sorted(
        [col for col in df.columns if is_month_col(col)],
        key=lambda c: datetime.strptime(c, "%b-%Y")
    )

    return df[fixed_cols + month_cols]
