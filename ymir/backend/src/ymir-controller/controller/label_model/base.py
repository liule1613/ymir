import json
import traceback
from abc import ABC, abstractmethod
from functools import wraps
from typing import Any, Callable, Dict, List

from requests.exceptions import ConnectionError

from common_utils.percent_log_util import LogState
from controller.config import label_task as label_task_config
from controller.utils import tasks_util
from controller.utils.redis import rds
from id_definition.error_codes import CTLResponseCode


def catch_label_task_error(f: Callable) -> Callable:
    @wraps(f)
    def wrapper(*args: tuple, **kwargs: Any) -> object:
        try:
            _ret = f(*args, **kwargs)
        except ConnectionError as e:
            tasks_util.write_task_progress(monitor_file=kwargs["monitor_file_path"],
                                           tid=kwargs["task_id"],
                                           percent=0.0,
                                           state=LogState.ERROR,
                                           error_code=CTLResponseCode.INVOKER_LABEL_TASK_NETWORK_ERROR,
                                           error_message=str(e),
                                           msg=traceback.format_exc())
            return None
        except Exception as e:
            tasks_util.write_task_progress(monitor_file=kwargs["monitor_file_path"],
                                           tid=kwargs["task_id"],
                                           percent=0.0,
                                           state=LogState.ERROR,
                                           error_code=CTLResponseCode.INVOKER_LABEL_TASK_UNKNOWN_ERROR,
                                           error_message=str(e),
                                           msg=traceback.format_exc())
            return None

        return _ret

    return wrapper


class LabelBase(ABC):
    @abstractmethod
    def create_label_project(self, project_name: str, keywords: List, collaborators: List, expert_instruction: str,
                             **kwargs: Dict) -> int:
        # Create a label project, add extra args in kwargs if you need
        pass

    @abstractmethod
    def set_import_storage(self, project_id: int, import_path: str) -> int:
        # Create import storage to label tool
        pass

    @abstractmethod
    def set_export_storage(self, project_id: int, export_path: str) -> int:
        # Create export storage to label tool
        pass

    @abstractmethod
    def sync_import_storage(self, storage_id: int) -> Any:
        # Sync tasks from import storage to label tool
        pass

    @abstractmethod
    def convert_annotation_to_voc(self, project_id: int, des_path: str) -> Any:
        # because ymir supporting voc files to import
        pass

    @abstractmethod
    def get_task_completion_percent(self, project_id: int) -> float:
        pass

    @abstractmethod
    def run(self, **kwargs: Dict) -> Any:
        # start a label task
        pass

    # now we have to loop label task for get status
    # maybe add API for labeling tool to report self status later https://labelstud.io/guide/webhooks.html
    @staticmethod
    def store_label_task_mapping(project_id: int, task_id: str, monitor_file_path: str, des_annotation_path: str,
                                 repo_root: str, media_location: str, import_work_dir: str, storage_id: int) -> None:
        # store into redis for loop get status
        label_task_content = dict(project_id=project_id,
                                  task_id=task_id,
                                  monitor_file_path=monitor_file_path,
                                  des_annotation_path=des_annotation_path,
                                  repo_root=repo_root,
                                  media_location=media_location,
                                  import_work_dir=import_work_dir,
                                  storage_id=storage_id)

        rds.hset(name=label_task_config.MONITOR_MAPPING_KEY, mapping={task_id: json.dumps(label_task_content)})
