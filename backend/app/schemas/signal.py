from pydantic import BaseModel, ConfigDict, Field


class ScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    strategy_id: str = Field(min_length=1, max_length=36)
    symbol: str = Field(min_length=1, max_length=20)
