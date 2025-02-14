import React, { useEffect, useRef, useState } from "react"
import { connect } from 'dva'
import { useParams, Link, useHistory } from "umi"
import { Button, Card, Col, Descriptions, List, Progress, Row, Space, Tag } from "antd"

import t from "@/utils/t"
import { format } from '@/utils/date'
import { getTensorboardLink } from '@/services/common'
import Breadcrumbs from "@/components/common/breadcrumb"
import { getTaskStates, getTaskTypes } from '@/constants/query'
import Terminate from "./components/terminate"
import { TASKSTATES, TASKTYPES, getTaskTypeLabel } from '@/constants/task'
import StateTag from '@/components/task/stateTag'
import styles from "./detail.less"
import {
  ArrowDownIcon, ArrowUpIcon, ScreenIcon, TaggingIcon, TrainIcon, VectorIcon,
  FileYesIcon, FileHistoryIcon, SearchEyeIcon, SearchIcon
} from "@/components/common/icons"
import { percent, toFixed } from "../../utils/number"

const { Item } = Descriptions

const initError = {
  code: 0,
  message: ''
}

function TaskDetail({ getTask, getDataset, batchDatasets, getModel, taskItem }) {
  const history = useHistory()
  const { id } = useParams()
  const [task, setTask] = useState({})
  const [dataset, setDataset] = useState({})
  const terminateRef = useRef(null)
  const [model, setModel] = useState({})
  const [error, setError] = useState(initError)
  const [showErrorMsg, setShowErrorMsg] = useState(false)

  useEffect(() => {
    setTask(taskItem)
  }, [taskItem])

  useEffect(() => {
    resetData()
    fetchTask()
  }, [id])

  useEffect(async () => {
    getResult()
    getError()
    goAnchor()
  }, [task])

  function fetchTask() {
    getTask(id)
  }

  function resetData() {
    setTask({})
    setModel({})
    setDataset({})
    setError({})
  }

  function getResult() {
    if (isType(TASKTYPES.TRAINING)) {
      // model
      fetchResultModel()
    } else {
      fetchResultDataset()
    }
  }

  async function fetchResultDataset() {
    const id = task.result?.dataset_id
    if (!id) {
      return setDataset({})
    }
    const result = await getDataset(id)
    if (result) {
      setDataset(result)
    } else {
      setDataset({ id })
    }
    goAnchor()
  }

  async function fetchResultModel() {
    const id = task.result?.model_id
    if (!id) {
      return setDataset({})
    }
    const result = await getModel(id)
    if (result) {
      setModel(result)
    } else {
      setModel({ id })
    }
    goAnchor()
  }

  function terminate(task) {
    terminateRef.current.confirm(task)
  }

  function terminateOk() {
    fetchTask()
  }

  function goAnchor() {
    const anchor = history.location.hash
    if (anchor) {
      location.href = anchor
    }
  }

  function getError() {
    const error = task.result?.error
    if (error) {
      setError(error)
    } else {
      setError(initError)
    }
  }

  function isType(type) {
    return type === task.type
  }

  function isState(state) {
    return state === task.state
  }

  const percentFormat = (value) => {
    return Number(value) * 100 + '%'
  }

  function getTypeLabel(type) {
    const types = getTaskTypes()
    const target = types.find(t => t.value === type)
    return target ? target.label : ''
  }

  function formatErrorMessage(message) {
    return <div hidden={!showErrorMsg} style={{ backgroundColor: '#f6f6f6', padding: 20 }}>
      {message.split('\n').map((item, i) => <div key={i}>{item}</div>)}
    </div>
  }

  const labelStyle = { width: '15%', paddingRight: '20px', justifyContent: 'flex-end' }

  function renderDatasetName(dts = []) {
    return <Space>{dts.map(d => d ? <Link key={d.id} to={`/home/dataset/detail/${d.id}`}>{d.name}</Link> : ids)}</Space>
  }

  function renderConfig(config = {}) {
    return Object.keys(config).map(key => <Row key={key} wrap={false}>
      <Col flex={'200px'} style={{ fontWeight: 'bold' }}>{key}:</Col>
      <Col flex={1}>{config[key]}</Col>
    </Row>)
  }

  const renderTitle = (
    <Row>
      <Col flex={1}><strong>{getTaskTypeLabel(task.type)}{t('task.detail.title')}</strong></Col>
      <Col><Button type='link' onClick={() => history.goBack()}>{t('common.back')}&gt;</Button></Col>
    </Row>
  )

  function renderResultTitle(type) {
    let title = t('task.detail.result.empty')
    if (model.id) {
      title = t('task.mining.form.model.label')
    } else if (dataset.id) {
      title = t('task.filter.form.datasets.label')
    } else if (error.code) {
      title = t('task.detail.error.title')
    }

    return <><FileYesIcon />{t('task.detail.result.title')}: {title}</>
  }

  return (
    <div className={styles.taskDetail}>
      <Breadcrumbs />
      <Card title={renderTitle}>
        {/* <h3 className={styles.title}>{t("task.detail.title")}</h3> */}
        <Descriptions column={2} bordered labelStyle={labelStyle} title={<><SearchEyeIcon /> {t("task.detail.title")} </>} className={styles.infoTable}>
          <Item label={t('task.detail.label.name')}>{task.name}</Item>
          <Item label={t('task.detail.label.id')}>{task.id}</Item>
          {isType(TASKTYPES.FILTER) ? (
            <>
              <Item label={t('task.filter.form.datasets.label')} span={2}>{renderDatasetName(task.filterSets)}</Item>
              <Item label={t('task.filter.form.include.label')}>{task.parameters.include_classes?.map(key => <Tag key={key}>{key}</Tag>)}</Item>
              {task.parameters.exclude_classes?.length ? <Item label={t('task.filter.form.exclude.label')}>{task.parameters.exclude_classes?.map(key => <Tag key={key}>{key}</Tag>)}</Item> : null}
            </>
          ) : null}

          {isType(TASKTYPES.TRAINING) ? (
            <>
              {/* train */}
              <Item label={t('task.train.form.trainsets.label')}>{renderDatasetName(task.trainSets)} </Item>
              <Item label={t('task.train.form.testsets.label')}>{renderDatasetName(task.testSets)} </Item>
              {/* <Item label={t('task.detail.label.train_type')}>{task.parameters?.train_type}</Item> */}
              <Item label={t('task.detail.label.train_goal')}>{task.parameters.include_classes?.map(keyword => <Tag key={keyword}>{keyword}</Tag>)}</Item>
              <Item label={t('task.detail.label.framework')}>{task.parameters?.network} </Item>
              <Item label={t('task.detail.label.create_time')}>{format(task.create_datetime)} </Item>
              <Item label={t('task.detail.label.backbone')}>{task.parameters?.backbone}</Item>
              <Item label={t('task.detail.label.training.image')}>{task.parameters.docker_image}</Item>
              <Item label={t('task.mining.form.model.label')}>
                {task.parameters.model_id ? <Link to={`/home/model/detail/${task.parameters.model_id}`}>{task?.model?.name || task.parameters.model_id}</Link> : ''}
              </Item>
              <Item label={t('task.detail.label.hyperparams')} span={2}>{renderConfig(task.config)}</Item>
              <Item label={'TensorBoard'} span={2}><Link target="_blank" to={getTensorboardLink(task.hash)}>{t('task.detail.tensorboard.link.label')}</Link></Item>
            </>
          ) : null}

          {isType(TASKTYPES.MINING) ? (
            <>
              {/* mining */}
              <Item label={t('task.filter.form.datasets.label')}>{renderDatasetName(task.filterSets)}</Item>
              <Item label={t('task.mining.form.excludeset.label')}>{renderDatasetName(task.excludeSets)}</Item>
              <Item label={t('task.mining.form.model.label')}>
                <Link to={`/home/model/detail/${task.parameters.model_id}`}>{task?.model?.name || task.parameters.model_id}</Link>
              </Item>
              <Item label={t('task.mining.form.algo.label')}>{task.parameters.mining_algorithm}</Item>
              <Item label={t('task.mining.form.label.label')}>{task.parameters.generate_annotations ? t('common.yes') : t('common.no')}</Item>
              <Item label={t('task.mining.form.topk.label')}>{task.parameters.top_k}</Item>
              <Item label={t('task.detail.label.mining.image')}>{task.parameters.docker_image}</Item>
              <Item label={t('task.detail.label.hyperparams')}>{renderConfig(task.config)}</Item>
            </>
          ) : null}

          {isType(TASKTYPES.LABEL) ? (
            <>
              {/* label */}
              <Item label={t('task.filter.form.datasets.label')}>{renderDatasetName(task.filterSets)}</Item>
              <Item label={t('task.label.form.member')}>{task.parameters.labellers.map(m => <Tag key={m}>{m}</Tag>)}</Item>
              <Item label={t('task.label.form.target.label')}>{task.parameters.include_classes?.map(keyword => <Tag key={keyword}>{keyword}</Tag>)}</Item>
              <Item label={t('task.label.form.keep_anno.label')}>{task.parameters.keep_annotations ? t('common.yes') : t('common.no')}</Item>
              <Item label={t('task.label.form.desc.label')}>
                {task.parameters.extra_url ? <a target='_blank' href={task.parameters.extra_url}>{t('task.detail.label.download.btn')}</a> : '-'}
              </Item>
            </>
          ) : null}
        </Descriptions>

        <Descriptions bordered labelStyle={labelStyle} title={<><FileHistoryIcon /> {t("task.detail.state.title")} </>} className={styles.infoTable}>
          <Item label={t('task.detail.state.current')}>
            <Row>
              <Col><StateTag state={task.state} /></Col>
              <Col flex={1}>{task.state === TASKSTATES.DOING ? <Progress strokeColor={'#FAD337'} percent={toFixed(task.progress, 2)} /> : null}</Col>
              {[TASKSTATES.PENDING, TASKSTATES.DOING].indexOf(task.state) > -1 ?
                <Col><Button onClick={() => terminate(task)}>{t('task.action.terminate')}</Button></Col> : null}
            </Row>
          </Item>
        </Descriptions>
        <div id="result"></div>
        <Descriptions
          bordered
          column={1}
          className={styles.infoTable}
          labelStyle={labelStyle}
          title={renderResultTitle()}
        >
          {dataset.id ? (dataset.name ? <>
            <Item label={t('task.detail.dataset.name')}>
              <Row>
                <Col flex={1} style={{ lineHeight: '32px' }}><Link to={`/home/dataset/detail/${dataset.id}`}>{dataset.name}</Link></Col>
                <Col>
                  <Space>
                    {isType(TASKTYPES.MINING) ? <>
                      <Button icon={<SearchIcon />} type='primary' onClick={() => history.push(`/home/dataset/detail/${dataset.id}`)}>{t('task.detail.action.detail')}</Button>
                    </> : <>
                      <Button icon={<ScreenIcon />} type='primary' hidden={!dataset.keyword_count}
                        onClick={() => history.push(`/home/task/filter/${dataset.id}`)}>{t('dataset.detail.action.filter')}</Button>
                      <Button icon={<TrainIcon />} type='primary' onClick={() => history.push(`/home/task/train/${dataset.id}`)}>{t('dataset.detail.action.train')}</Button>
                    </>}
                    <Button icon={<TaggingIcon />} type='primary' onClick={() => history.push(`/home/task/label/${dataset.id}`)}>{t('dataset.detail.action.label')}</Button>
                  </Space>
                </Col>
              </Row>
            </Item>
            <Item label={t('dataset.column.asset_count')}>{dataset.asset_count}</Item>
            <Item label={t('dataset.column.keyword')}>{dataset.keywords.map(keyword => <Tag key={keyword}>{keyword}</Tag>)}</Item>
            <Item label={t('dataset.column.create_time')}>{format(dataset.create_datetime)}</Item>
          </> : <Item label={t('task.detail.state.current')}>{t('task.detail.model.deleted')}</Item>)
            : null}
          {model.id ? (model.name ? <>
            <Item label={t('model.column.name')}>
              <Row>
                <Col flex={1} style={{ lineHeight: '32px' }}><Link to={`/home/model/detail/${model.id}`}>{model.name}</Link> </Col>
                <Col>
                  <Space>
                    <Button icon={<VectorIcon />} type='primary' onClick={() => history.push(`/home/task/mining?mid=${model.id}`)}>{t('dataset.action.mining')}</Button>
                    <Button icon={<TrainIcon />} type='primary' onClick={() => history.push(`/home/task/train/?mid=${model.id}`)}>{t('task.detail.action.continuetrain')}</Button>
                  </Space>
                </Col>
              </Row>
            </Item>
            <Item label={'ID'}>{model.id}</Item>
            <Item label={t('model.column.target')}>{model.keywords.join(', ')}</Item>
            <Item label={'mAP'}><span title={model.map}>{percent(model.map)}</span></Item>
            <Item label={t('model.column.create_time')}>{format(task.create_datetime)}</Item>
          </> : <Item label={t('task.detail.state.current')}>{t('task.detail.model.deleted')}</Item>)
            : null}
          {error.code ? <>
            <Item label={t('task.detail.error.code')}>{getTypeLabel(task.type)}{t('task.detail.error.title')}</Item>
            <Item label={t('task.detail.error.desc')}>
              <div>
                <Button type="link" onClick={() => setShowErrorMsg(!showErrorMsg)}>
                  {showErrorMsg ? t('common.fold') : t('common.unfold')}{showErrorMsg ? <ArrowUpIcon /> : <ArrowDownIcon />}
                </Button>
                <p>{t(`error${error.code}`)}</p>
              </div>
            </Item>
          </>
            : null}
        </Descriptions>
        {task.type === TASKTYPES.LABEL ? <div style={{ textAlign: 'right' }}><Link target="_blank" to='/label_tool/'>{t('task.detail.label.go.platform')}</Link></div> : null}
        <Terminate ref={terminateRef} ok={terminateOk} />
      </Card>
    </div>
  )
}


const props = (state) => {
  return {
    logined: state.user.logined,
    taskItem: state.task.task,
  }
}

const actions = (dispatch) => {
  return {
    getTask: (payload) => {
      return dispatch({
        type: 'task/getTask',
        payload,
      })
    },
    getDataset: (id) => {
      return dispatch({
        type: 'dataset/getDataset',
        payload: id
      })
    },
    batchDatasets: (ids) => {
      return dispatch({
        type: 'dataset/batchDatasets',
        payload: ids
      })
    },
    getModel: (id) => {
      return dispatch({
        type: 'model/getModel',
        payload: id
      })
    }
  }
}

export default connect(props, actions)(TaskDetail)
