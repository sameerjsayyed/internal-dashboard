from sqlmodel import SQLModel, Field
from datetime import datetime

class UploadHistory(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    file_name: str
    file_size_kb: int
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
