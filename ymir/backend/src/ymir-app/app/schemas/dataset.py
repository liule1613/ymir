import enum
import json
from typing import Any, List, Optional, Union

from pydantic import AnyHttpUrl, BaseModel, Field, root_validator

from app.constants.state import TaskState, TaskType
from app.schemas.common import (
    Common,
    DateTimeModelMixin,
    IdModelMixin,
    IsDeletedModelMixin,
)


class ImportStrategy(enum.IntEnum):
    no_annotations = 1
    ignore_unknown_annotations = 2
    stop_upon_unknown_annotations = 3


class DatasetBase(BaseModel):
    name: str
    hash: str
    type: TaskType = Field(description="comes from related task type")
    state: Optional[int] = TaskState.pending.value
    predicates: Optional[str]
    asset_count: Optional[int]
    keyword_count: Optional[int]
    user_id: int
    task_id: Optional[int]


class DatasetImport(BaseModel):
    name: str = Field(description="dataset name")
    input_url: Optional[Union[AnyHttpUrl, str]] = Field(description="from url")
    input_dataset_id: Optional[int] = Field(description="from other's dataset")
    input_token: Optional[str] = Field(description="from uploaded file token")
    input_path: Optional[str] = Field(description="from path on ymir server")
    strategy: ImportStrategy = Field(description="strategy about importing annotations")

    @root_validator
    def check_input_source(cls, values: Any) -> Any:
        fields = ("input_url", "input_dataset_id", "input_token", "input_path")
        if all(values.get(i) is None for i in fields):
            raise ValueError("Missing input source")
        return values


class DatasetCreate(DatasetBase):
    pass


class DatasetUpdate(BaseModel):
    name: Optional[str]
    state: Optional[int]
    predicates: Optional[str]
    asset_count: Optional[int]
    keyword_count: Optional[int]


class DatasetInDB(IdModelMixin, DateTimeModelMixin, IsDeletedModelMixin, DatasetBase):
    class Config:
        orm_mode = True


class Dataset(DatasetInDB):
    parameters: Optional[Any] = None
    config: Optional[Any] = None
    predicates: Optional[str] = None
    keywords: Optional[List[str]] = None
    ignored_keywords: Optional[List[str]] = None
    source: Optional[TaskType] = None
    progress: Optional[float] = None
    task_id: Optional[int] = None
    task_name: Optional[str] = None
    task_state: Optional[int] = None
    task_progress: Optional[float] = None
    task_parameters: Optional[Any] = None
    task_config: Optional[Any] = None

    @root_validator()
    def make_up_fields(cls, values: Any) -> Any:
        raw = values.pop("task_parameters", None)
        parameters = json.loads(raw) if raw else {}
        values["parameters"] = parameters

        task_config_str = values.pop("task_config", None)
        task_config = json.loads(task_config_str) if task_config_str else {}
        values["config"] = task_config

        predicates = values.pop("predicates", None)
        predicates = json.loads(predicates) if predicates else {}
        values["keywords"] = predicates.get("keywords", [])
        values["ignored_keywords"] = predicates.get("ignored_keywords", [])

        values["source"] = values.get("type")
        if not values["state"]:
            # for legacy model records that have no state,
            # use related task_state as fallback
            values["state"] = values.get("task_state")
        values["progress"] = values.get("task_progress")
        return values


class Datasets(BaseModel):
    total: int
    items: List[Dataset]


class DatasetOut(Common):
    result: Union[Dataset, Datasets, List[Dataset]]


class DatasetsOut(Common):
    result: List[Dataset]
