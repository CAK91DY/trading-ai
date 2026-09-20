from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Rule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    indicator: Literal["ema_fast", "ema_slow", "rsi"]
    operator: Literal[">", ">=", "<", "<="]
    value: Literal["ema_fast", "ema_slow"] | float

    @model_validator(mode="after")
    def compatible(self):
        if self.indicator == "rsi":
            if isinstance(self.value, str) or not 0 <= self.value <= 100:
                raise ValueError("Le seuil RSI doit être compris entre 0 et 100.")
        elif not isinstance(self.value, str) or self.value == self.indicator:
            raise ValueError("Comparez une EMA à l’autre EMA.")
        return self


class Definition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fast: int = Field(default=20, ge=2, le=500)
    slow: int = Field(default=50, ge=3, le=1000)
    entry_mode: Literal["all", "any"] = "all"
    exit_mode: Literal["all", "any"] = "any"
    entry: list[Rule] = Field(min_length=1, max_length=8)
    exit: list[Rule] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def periods(self):
        if self.fast >= self.slow:
            raise ValueError("EMA rapide doit être inférieure à EMA lente.")
        return self


class StrategyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    active: bool = True
    definition: Definition

    @model_validator(mode="after")
    def trim(self):
        self.name = self.name.strip()
        if not self.name:
            raise ValueError("Nom requis.")
        return self
