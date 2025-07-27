from sqlmodel import SQLModel, Field
from datetime import datetime
import pytz

def get_ist_now():
    """Get current time in IST timezone"""
    ist = pytz.timezone('Asia/Kolkata')
    return datetime.now(ist)

class UploadHistory(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    file_name: str
    file_size_kb: int
    uploaded_at: datetime = Field(default_factory=get_ist_now)
