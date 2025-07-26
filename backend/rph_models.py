from sqlmodel import SQLModel, Field
from typing import Optional

class RPHMaster(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    contract_code: str
    contract_name: str
    contract_manager: Optional[str] = None
    task_code: str
    task_manager: Optional[str] = None
    rph: float

class RPHMasterCreate(SQLModel):
    contract_code: str
    contract_name: str
    contract_manager: Optional[str] = None
    task_code: str
    task_manager: Optional[str] = None
    rph: float