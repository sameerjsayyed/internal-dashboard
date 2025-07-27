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
        engine=engine,
        # Don't force all columns to string - let pandas handle date columns naturally
    )
    df.columns = sniff.iloc[header_row].str.strip().tolist()[: df.shape[1]]

    # Use Project Description as contract name
    if PROJECT_DESCRIPTION in df.columns:
        df[PROJECT_DESCRIPTION] = df[PROJECT_DESCRIPTION].fillna("").astype(str)
    else:
        df[PROJECT_DESCRIPTION] = ""
    df[TASK_NAME] = df[TASK_NAME].fillna("").astype(str)
    df[BOOKED_HOURS_COL] = pd.to_numeric(df[BOOKED_HOURS_COL], errors="coerce").fillna(0)
    
    # Ensure merge columns are strings for consistent merging with RPH data
    df[CONTRACT_NUMBER_COL] = df[CONTRACT_NUMBER_COL].astype(str)
    df[TASK_NUMBER_COL] = df[TASK_NUMBER_COL].astype(str)
    
    # print(f"Contract Number column type: {df[CONTRACT_NUMBER_COL].dtype}")
    # print(f"Task Number column type: {df[TASK_NUMBER_COL].dtype}")
    # print(f"Sample Contract Numbers: {df[CONTRACT_NUMBER_COL].head().tolist()}")
    # print(f"Sample Task Numbers: {df[TASK_NUMBER_COL].head().tolist()}")
    
    # Handle multiple date formats
    # print(f"Original date column type: {df[TIME_BOOKING_DATE_COL].dtype}")
    # print(f"Sample date values: {df[TIME_BOOKING_DATE_COL].head().tolist()}")
    
    # If the column is already datetime (Excel auto-converted), use it directly
    if pd.api.types.is_datetime64_any_dtype(df[TIME_BOOKING_DATE_COL]):
        print("Date column already converted to datetime by pandas")
    else:
        # First try parsing with the expected format
        df[TIME_BOOKING_DATE_COL] = pd.to_datetime(df[TIME_BOOKING_DATE_COL], format=DATE_FMT, errors="coerce")
        
        # If first format fails, try MM/dd/yy format
        mask = df[TIME_BOOKING_DATE_COL].isna()
        if mask.any():
            print(f"Failed to parse {mask.sum()} dates with format {DATE_FMT}, trying alternative format")
            df.loc[mask, TIME_BOOKING_DATE_COL] = pd.to_datetime(
                df.loc[mask, TIME_BOOKING_DATE_COL], format="%m/%d/%y", errors="coerce"
            )
        
        # If still some dates failed, try pandas automatic parsing
        mask = df[TIME_BOOKING_DATE_COL].isna()
        if mask.any():
            print(f"Still {mask.sum()} unparseable dates, trying automatic parsing")
            df.loc[mask, TIME_BOOKING_DATE_COL] = pd.to_datetime(
                df.loc[mask, TIME_BOOKING_DATE_COL], errors="coerce"
            )
    
    print(f"Final parsed dates: {df[TIME_BOOKING_DATE_COL].head().tolist()}")
    print(f"Null dates remaining: {df[TIME_BOOKING_DATE_COL].isna().sum()}")
    
    # Final check - if any dates are still unparseable, log a warning
    if df[TIME_BOOKING_DATE_COL].isna().any():
        print(f"⚠ Warning: {df[TIME_BOOKING_DATE_COL].isna().sum()} dates could not be parsed")
        print(f"Sample unparseable dates: {df[df[TIME_BOOKING_DATE_COL].isna()][TIME_BOOKING_DATE_COL].head().tolist()}")
    
    # Ensure we have valid datetime objects for the rest of the processing
    df[TIME_BOOKING_DATE_COL] = pd.to_datetime(df[TIME_BOOKING_DATE_COL], errors="coerce")

    df["Month"] = df[TIME_BOOKING_DATE_COL].dt.strftime(MONTH_FMT)
    # print(f"df: {df}")
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

    return {
        "taskWise": sort_month_columns(task_df),
        "resourceWise": sort_month_columns(resource_df),
        "consolidated": sort_month_columns(consolidated_df)
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
