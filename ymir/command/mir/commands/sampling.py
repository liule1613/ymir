import argparse
import logging
import random

from mir.commands import base
from mir.protos import mir_command_pb2 as mirpb
from mir.tools import checker, mir_storage_ops, revs_parser
from mir.tools.code import MirCode
from mir.tools.command_run_in_out import command_run_in_out
from mir.tools.errors import MirRuntimeError


class CmdSampling(base.BaseCommand):
    def run(self) -> int:
        logging.debug("command sampling: %s", self.args)
        return CmdSampling.run_with_args(mir_root=self.args.mir_root,
                                         work_dir=self.args.work_dir,
                                         src_revs=self.args.src_revs,
                                         dst_rev=self.args.dst_rev,
                                         count=self.args.count,
                                         rate=self.args.rate)

    @staticmethod
    @command_run_in_out
    def run_with_args(mir_root: str, work_dir: str, src_revs: str, dst_rev: str, count: int, rate: float) -> int:
        if not src_revs:
            raise MirRuntimeError(error_code=MirCode.RC_CMD_INVALID_ARGS, error_message='invalid args: --src-revs')
        src_typ_rev_tid = revs_parser.parse_single_arg_rev(src_revs)
        if checker.check_src_revs(src_typ_rev_tid) != MirCode.RC_OK:
            raise MirRuntimeError(error_code=MirCode.RC_CMD_INVALID_ARGS, error_message='invalid args: --src-revs')

        if not dst_rev:
            raise MirRuntimeError(error_code=MirCode.RC_CMD_INVALID_ARGS, error_message='invalid args: --dst-rev')
        dst_typ_rev_tid = revs_parser.parse_single_arg_rev(dst_rev)
        if checker.check_dst_rev(dst_typ_rev_tid) != MirCode.RC_OK:
            raise MirRuntimeError(error_code=MirCode.RC_CMD_INVALID_ARGS, error_message='invalid args: --dst-rev')

        if count < 0:
            raise MirRuntimeError(error_code=MirCode.RC_CMD_INVALID_ARGS, error_message='invalid args: --count')
        if rate < 0 or rate > 1:
            raise MirRuntimeError(error_code=MirCode.RC_CMD_INVALID_ARGS, error_message='invalid args: --rate')

        if not mir_root:
            mir_root = '.'

        # read all
        mir_datas = mir_storage_ops.MirStorageOps.load(
            mir_root=mir_root,
            mir_branch=src_typ_rev_tid.rev,
            mir_task_id=src_typ_rev_tid.tid,
            mir_storages=[mirpb.MirStorage.MIR_METADATAS, mirpb.MirStorage.MIR_ANNOTATIONS, mirpb.MirStorage.MIR_TASKS])
        mir_metadatas: mirpb.MirMetadatas = mir_datas[mirpb.MirStorage.MIR_METADATAS]
        assets_count = len(mir_metadatas.attributes)
        sampled_assets_count = 0
        if count > 0:
            sampled_assets_count = count
        else:
            sampled_assets_count = int(assets_count * rate)
        if sampled_assets_count < 0:
            raise MirRuntimeError(error_code=MirCode.RC_CMD_INVALID_ARGS,
                                  error_message=f"sampled assets count: {sampled_assets_count} is negative")
        if sampled_assets_count > assets_count:
            logging.warning(f"sampled assets count: {sampled_assets_count} > assets count: {assets_count}, select all")
            sampled_assets_count = assets_count

        # sampling
        mir_annotations: mirpb.MirAnnotations = mir_datas[mirpb.MirStorage.MIR_ANNOTATIONS]
        if sampled_assets_count < assets_count:
            sampled_asset_ids = random.sample(mir_metadatas.attributes.keys(), sampled_assets_count)
            # sampled_mir_metadatas and sampled_mir_annotations
            image_annotations = mir_annotations.task_annotations[mir_annotations.head_task_id].image_annotations
            sampled_mir_metadatas = mirpb.MirMetadatas()
            sampled_mir_annotations = mirpb.MirAnnotations()
            for asset_id in sampled_asset_ids:
                sampled_mir_metadatas.attributes[asset_id].CopyFrom(mir_metadatas.attributes[asset_id])
                if asset_id in image_annotations:
                    sampled_mir_annotations.task_annotations[dst_typ_rev_tid.tid].image_annotations[asset_id].CopyFrom(
                        image_annotations[asset_id])
        else:
            # if equals
            sampled_mir_metadatas = mir_metadatas
            sampled_mir_annotations = mirpb.MirAnnotations()
            sampled_mir_annotations.head_task_id = dst_typ_rev_tid.tid
            sampled_mir_annotations.task_annotations[dst_typ_rev_tid.tid].CopyFrom(
                mir_annotations.task_annotations[mir_annotations.head_task_id]
            )

        # mir_tasks
        message = f"sampling src: {src_revs}, dst: {dst_rev}, count: {count}, rate: {rate}"
        mir_tasks = mir_datas[mirpb.MirStorage.MIR_TASKS]
        mir_storage_ops.update_mir_tasks(mir_tasks=mir_tasks,
                                         task_type=mirpb.TaskType.TaskTypeSampling,
                                         task_id=dst_typ_rev_tid.tid,
                                         message=message)

        logging.info(f"sampling done, assets count: {sampled_assets_count}")

        # save and commit
        sampled_mir_datas = {
            mirpb.MirStorage.MIR_METADATAS: sampled_mir_metadatas,
            mirpb.MirStorage.MIR_ANNOTATIONS: sampled_mir_annotations,
            mirpb.MirStorage.MIR_TASKS: mir_tasks,
        }
        mir_storage_ops.MirStorageOps.save_and_commit(mir_root=mir_root,
                                                      mir_branch=dst_typ_rev_tid.rev,
                                                      task_id=dst_typ_rev_tid.tid,
                                                      his_branch=src_typ_rev_tid.rev,
                                                      mir_datas=sampled_mir_datas,
                                                      commit_message=message)

        return MirCode.RC_OK


def bind_to_subparsers(subparsers: argparse._SubParsersAction, parent_parser: argparse.ArgumentParser) -> None:
    sampling_arg_parser = subparsers.add_parser('sampling',
                                                parents=[parent_parser],
                                                description='use this command to sample assets',
                                                help='sample assets')
    sampling_arg_parser.add_argument('--src-revs', dest='src_revs', type=str, help='rev@bid')
    sampling_arg_parser.add_argument('--dst-rev', dest='dst_rev', type=str, help='rev@tid')
    sampling_arg_parser.add_argument('-w', dest='work_dir', type=str, required=False, help='working directory')
    group = sampling_arg_parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--count', dest='count', type=int, default=0, help='assets count')
    group.add_argument('--rate', dest='rate', type=float, default=0.0, help='assets sampling rate')
    sampling_arg_parser.set_defaults(func=CmdSampling)