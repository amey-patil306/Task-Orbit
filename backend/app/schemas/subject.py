from pydantic import BaseModel, ConfigDict, Field, field_validator


class SubjectIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    name: str = Field(min_length=1, max_length=100)
    colour: str = Field(default="#6366F1", pattern=r"^#[0-9A-Fa-f]{6}$")

    @field_validator("colour")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()
