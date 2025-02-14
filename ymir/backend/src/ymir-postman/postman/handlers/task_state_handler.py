from collections import defaultdict
from enum import IntEnum
import json
import logging
import requests
import time
from typing import Any, List, Set, Dict, Tuple

from fastapi.encoders import jsonable_encoder
from pydantic import parse_raw_as

from postman import entities, event_dispatcher  # type: ignore
from postman.settings import constants, settings


class _UpdateDbConclusion(IntEnum):
    SUCCESS = 0  # update success
    RETRY = 1  # update failed, need retry
    DROP = 2  # update failed, need drop


def _conclusion_from_return_code(return_code: int) -> _UpdateDbConclusion:
    if return_code == constants.RC_OK:
        return _UpdateDbConclusion.SUCCESS
    elif return_code == constants.RC_FAILED_TO_UPDATE_TASK_STATUS:
        return _UpdateDbConclusion.RETRY
    else:
        return _UpdateDbConclusion.DROP


class _UpdateDbResult:
    def __init__(self) -> None:
        self.success_tids: Set[str] = set()
        self.retry_tids: Set[str] = set()
        self.drop_tids: Set[str] = set()

    def __repr__(self) -> str:
        return f"success: {self.success_tids}, retry: {self.retry_tids}, drop: {self.drop_tids}"


redis_connect = event_dispatcher.EventDispatcher.get_redis_connect()


def on_task_state(ed: event_dispatcher.EventDispatcher, mid_and_msgs: list, **kwargs: Any) -> None:
    tid_to_taskstates_latest = _aggregate_msgs(mid_and_msgs)
    if not tid_to_taskstates_latest:
        return

    # update db, save failed
    update_db_result = _update_db(tid_to_tasks=tid_to_taskstates_latest)
    logging.info(f"update db result: {update_db_result}")
    _update_sio(tids=update_db_result.success_tids, tid_to_taskstates=tid_to_taskstates_latest)
    _update_retry(retry_tids=update_db_result.retry_tids, tid_to_taskstates_latest=tid_to_taskstates_latest)
    # delay and retry
    if update_db_result.retry_tids:
        time.sleep(settings.RETRY_SECONDS)
        ed.add_event(event_name=ed.event_name, event_topic=constants.EVENT_TOPIC_INNER, event_body='')


def _aggregate_msgs(mid_and_msgs: List[Tuple[str, dict]]) -> entities.TaskStateDict:
    """
    for all redis stream msgs, deserialize them to entities, select the latest for each tid
    """
    tid_to_taskstates_latest: entities.TaskStateDict = _load_retry()
    if mid_and_msgs:
        for _, msg in mid_and_msgs:
            msg_topic = msg['topic']
            if msg_topic != constants.EVENT_TOPIC_RAW:
                continue

            tid_to_taskstates = parse_raw_as(entities.TaskStateDict, msg['body'])
            for tid, taskstate in tid_to_taskstates.items():
                if (tid not in tid_to_taskstates_latest
                        or tid_to_taskstates_latest[tid].percent_result.timestamp < taskstate.percent_result.timestamp):
                    tid_to_taskstates_latest[tid] = taskstate
    return tid_to_taskstates_latest


# private: update db
def _update_retry(retry_tids: Set[str], tid_to_taskstates_latest: entities.TaskStateDict) -> None:
    """
    save failed taskstates to redis cache

    Args:
        retry_tids (Set[str])
        tid_to_taskstates_latest (entities.TaskStateDict)
    """
    retry_tid_to_tasks = {tid: tid_to_taskstates_latest[tid] for tid in retry_tids if tid in tid_to_taskstates_latest}
    json_str = json.dumps(jsonable_encoder(retry_tid_to_tasks))
    redis_connect.set(name=settings.RETRY_CACHE_KEY, value=json_str)


def _load_retry() -> entities.TaskStateDict:
    """
    load failed taskstates from redis cache

    Returns:
        entities.TaskStateDict
    """
    json_str = redis_connect.get(name=settings.RETRY_CACHE_KEY)
    if not json_str:
        return {}

    return parse_raw_as(entities.TaskStateDict, json_str) or {}


def _update_db(tid_to_tasks: entities.TaskStateDict) -> _UpdateDbResult:
    """
    update db for all tasks in tid_to_tasks

    Args:
        tid_to_tasks (entities.TaskStateDict): key: tid, value: TaskState

    Returns:
        _UpdateDbResult: update db result (success, retry and drop tids)
    """
    update_db_result = _UpdateDbResult()
    custom_headers = {'api-key': settings.APP_API_KEY}
    for tid, task in tid_to_tasks.items():
        *_, code = _update_db_single_task(tid, task, custom_headers)
        if code == _UpdateDbConclusion.SUCCESS:
            update_db_result.success_tids.add(tid)
        elif code == _UpdateDbConclusion.RETRY:
            update_db_result.retry_tids.add(tid)
        else:
            update_db_result.drop_tids.add(tid)

    return update_db_result


def _update_db_single_task(tid: str, task: entities.TaskState, custom_headers: dict) -> Tuple[str, _UpdateDbConclusion]:
    """
    update db for single task

    Args:
        tid (str): task id
        task (entities.TaskState): task state
        custom_headers (dict)

    Returns:
        Tuple[str, _UpdateDbConclusion]: error_message, result conclusion (success, retry or drop)
    """
    url = f"http://{settings.APP_API_HOST}/api/v1/tasks/status"

    # task_data: see api: /api/v1/tasks/status
    task_data = {
        'hash': tid,
        'timestamp': task.percent_result.timestamp,
        'state': task.percent_result.state,
        'percent': task.percent_result.percent,
        'state_code': task.percent_result.state_code,
        'state_message': task.percent_result.state_message,
    }

    logging.debug(f"update db single task request: {task_data}")
    try:
        response = requests.post(url=url, headers=custom_headers, json=task_data)
        response.raise_for_status()
    except (requests.exceptions.RequestException, requests.exceptions.HTTPError) as e:
        logging.exception(msg=f"update db single task error ignored: {tid}, {e}")
        return (f"{type(e).__name__}: {e}", _UpdateDbConclusion.RETRY)

    response_obj = json.loads(response.text)
    return_code = int(response_obj['code'])
    return_msg = response_obj.get('message', '')

    return (return_msg, _conclusion_from_return_code(return_code))


# private: socketio
def _update_sio(tids: Set[str], tid_to_taskstates: entities.TaskStateDict) -> None:
    if not tids:
        return

    event_payloads = _remap_payloads_by_uid({tid: tid_to_taskstates[tid] for tid in tids if tid in tid_to_taskstates})

    url = f"{settings.PM_URL}/events/push"
    try:
        requests.post(url=url, json=jsonable_encoder(event_payloads))
    except requests.exceptions.RequestException:
        logging.exception('update sio error ignored')


def _remap_payloads_by_uid(tid_to_taskstates: entities.TaskStateDict) -> entities.EventPayloadList:
    # sort by user
    uid_to_taskdatas: Dict[str, Dict[str, entities.TaskStatePercent]] = defaultdict(dict)
    for tid, taskstate in tid_to_taskstates.items():
        uid = taskstate.task_extra_info.user_id
        uid_to_taskdatas[uid][tid] = taskstate.percent_result

    # get event payloads
    event_payloads = []
    for uid, tid_to_taskdatas in uid_to_taskdatas.items():
        event_payloads.append(
            entities.EventPayload(event='update_taskstate', namespace=f"/{uid}", data=tid_to_taskdatas))
    return event_payloads
