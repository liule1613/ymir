from typing import List

from controller.invoker.invoker_cmd_base import BaseMirControllerInvoker
from controller.utils import utils, checker, labels
from id_definition.error_codes import CTLResponseCode
from proto import backend_pb2


class LabelGetInvoker(BaseMirControllerInvoker):
    def pre_invoke(self) -> backend_pb2.GeneralResp:
        return checker.check_request(
            request=self._request,
            prerequisites=[checker.Prerequisites.CHECK_USER_ID],
        )

    @staticmethod
    def generate_response(all_labels: List[List]) -> backend_pb2.GeneralResp:
        response = utils.make_general_response(CTLResponseCode.CTR_OK, "")
        result = [",".join(one_row_labels) for one_row_labels in all_labels]
        response.csv_labels.extend(result)

        return response

    def invoke(self) -> backend_pb2.GeneralResp:
        expected_type = backend_pb2.RequestType.CMD_LABEL_GET
        if self._request.req_type != expected_type:
            return utils.make_general_response(CTLResponseCode.MIS_MATCHED_INVOKER_TYPE,
                                               f"expected: {expected_type} vs actual: {self._request.req_type}")

        label_handler = labels.LabelFileHandler(self._user_root)
        all_labels = label_handler.get_all_labels(with_reserve=False)

        return self.generate_response(all_labels)
