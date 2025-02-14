import React, { useEffect, useState } from "react"
import { connect } from "dva"
import { Select, Card, Input, Radio, Button, Form, Row, Col, ConfigProvider, Space, InputNumber } from "antd"
import {
  PlusOutlined,
  MinusCircleOutlined,
  UpSquareOutlined,
  DownSquareOutlined,
} from '@ant-design/icons'
import { formLayout } from "@/config/antd"
import { useHistory, useParams, useLocation } from "umi"

import TripleRates from "@/components/form/tripleRates"
import t from "@/utils/t"
import { TASKSTATES } from '@/constants/task'
import { TYPES } from '@/constants/image'
import Breadcrumbs from "@/components/common/breadcrumb"
import EmptyState from '@/components/empty/dataset'
import EmptyStateModel from '@/components/empty/model'
import { randomNumber } from "@/utils/number"
import Tip from "@/components/form/tip"
import ImageSelect from "../components/imageSelect"
import styles from "./index.less"
import commonStyles from "../common.less"
import ModelSelect from "../components/modelSelect"
import RecommendKeywords from "@/components/common/recommendKeywords"

const { Option } = Select

const TrainType = () => [{ id: "detection", label: t('task.train.form.traintypes.detect'), checked: true }]
const FrameworkType = () => [{ id: "YOLO v4", label: "YOLO v4", checked: true }]
const Backbone = () => [{ id: "darknet", label: "Darknet", checked: true }]

function Train({ getDatasets, createTrainTask, getSysInfo }) {
  const { ids } = useParams()
  const datasetIds = ids ? ids.split('|').map(id => parseInt(id)) : []
  const history = useHistory()
  const location = useLocation()
  const { mid, image } = location.query
  const [allDs, setAllDs] = useState([])
  const [datasets, setDatasets] = useState([])
  const [trainSets, setTrainSets] = useState([])
  const [validationSets, setValidationSets] = useState([])
  const [keywords, setKeywords] = useState([])
  const [selectedKeywords, setSelectedKeywords] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [form] = Form.useForm()
  const [seniorConfig, setSeniorConfig] = useState([])
  const [hpVisible, setHpVisible] = useState(false)
  const [selectedImage, setSelectedImage] = useState({})
  const [gpu_count, setGPU] = useState(0)
  const hpMaxSize = 30

  const renderRadio = (types) => {
    return (
      <Radio.Group>
        {types.map((type) => (
          <Radio value={type.id} key={type.id} defaultChecked={type.checked}>
            {type.label}
          </Radio>
        ))}
      </Radio.Group>
    )
  }

  useEffect(() => {
    fetchSysInfo()
  }, [])

  useEffect(async () => {
    let result = await getDatasets({ limit: 100000 })
    if (result?.items) {
      const ds = result.items.filter(dataset => TASKSTATES.FINISH === dataset.state)
      setAllDs(ds)
      setDatasets(ds)
    }
  }, [])

  useEffect(() => {
    let getKw = (sets) => {
      let kw = datasets.reduce((prev, curr) => sets.indexOf(curr.id) >= 0 ? prev.concat(curr.keywords) : prev, [])
      kw = [...new Set(kw)]
      kw.sort()
      return kw
    }
    const tkw = getKw(trainSets)
    const vkw = getKw(validationSets)
    const kws = tkw.filter(v => vkw.includes(v))
    setKeywords(kws)
  }, [trainSets, validationSets, datasets])

  useEffect(() => {
    form.setFieldsValue({ hyperparam: seniorConfig })
  }, [seniorConfig])

  useEffect(() => {
    setTrainSets(datasetIds)
  }, [ids])

  useEffect(() => {
    const state = location.state

    if (state?.record) {
      const { parameters, name, config, } = state.record
      const { include_classes, include_train_datasets, include_validation_datasets, strategy, docker_image_id, docker_image, model_id } = parameters
      const tSets = include_train_datasets || []
      const vSets = include_validation_datasets || []
      form.setFieldsValue({
        name: `${name}_${randomNumber()}`,
        train_sets: tSets,
        validation_sets: vSets,
        gpu_count: config.gpu_count,
        // keywords: include_classes,
        model: model_id,
        docker_image: docker_image_id + ',' + docker_image,
        strategy,
      })
      setConfig(config)
      setTrainSets(tSets)
      setValidationSets(vSets)
      setHpVisible(true)
      setSelectedKeywords(include_classes)

      history.replace({ state: {} })
    }
  }, [location.state])

  useEffect(() => {
    form.setFieldsValue({ keywords: selectedKeywords })
    if (selectedModel) {
      form.validateFields(['keywords'])
    }
  }, [selectedKeywords])

  const validTrainTarget = async (_, value) => {
    const kws = form.getFieldValue('keywords')
    if (!(inArray(kws, getKwsFromDatasets(trainSets)) && inArray(kws, getKwsFromDatasets(validationSets)))) {
      return Promise.reject(t('task.train.target.invalid.inter'))
    }
    if (selectedModel?.keywords && kws.toString() !== selectedModel?.keywords.toString()) {
      return Promise.reject(t('task.train.target.invalid.model'))
    }
    
    return Promise.resolve()
  }

  function getKwsFromDatasets(dss = []) {
    return dss.reduce((prev, curr) => [...((datasets.find(ds => ds.id === curr) || {}).keywords || []), ...prev], [])
  }

  function inArray (items, arr) {
    return items.every(item => arr.indexOf(item) > -1)
  }

  async function validHyperparam(rule, value) {

    const params = form.getFieldValue('hyperparam').map(({ key }) => key)
      .filter(item => item && item.trim() && item === value)
    if (params.length > 1) {
      return Promise.reject(t('task.validator.same.param'))
    } else {
      return Promise.resolve()
    }
  }

  async function fetchSysInfo() {
    const result = await getSysInfo()
    if (result) {
      setGPU(result.gpu_count)
    }
  }

  function trainSetChange(value) {
    setTrainSets(value)
  }
  function validationSetChange(value) {
    setValidationSets(value)
  }

  function selectRecommendKeywords(keyword) {
    const kws = [...new Set([...selectedKeywords, keyword])]
    setSelectedKeywords(kws)
  }

  function modelChange(value, model) {
    model && setSelectedKeywords(model.keywords)
    setSelectedModel(model)
  }

  function imageChange(_, image = {}) {
    const { configs } = image
    const configObj = (configs || []).find(conf => conf.type === TYPES.TRAINING) || {}
    setSelectedImage(image)
    setConfig(configObj.config)
  }

  function setConfig(config = {}) {
    const params = Object.keys(config).filter(key => key !== 'gpu_count').map(key => ({ key, value: config[key] }))
    setSeniorConfig(params)
  }

  const onFinish = async (values) => {
    const config = {}
    form.getFieldValue('hyperparam').forEach(({ key, value }) => key && value ? config[key] = value : null)

    const gpuCount = form.getFieldValue('gpu_count')
    if (gpuCount) {
      config['gpu_count'] = gpuCount
    }
    const img = (form.getFieldValue('docker_image') || '').split(',')
    const docker_image_id = Number(img[0])
    const docker_image = img[1]
    const params = {
      ...values,
      name: values.name.trim(),
      docker_image,
      docker_image_id,
      config,
    }
    if (selectedModel) {
      params.keywords = selectedModel.keywords
    }
    const result = await createTrainTask(params)
    if (result) {
      history.replace("/home/task")
    }
  }

  function onFinishFailed(errorInfo) {
    console.log("Failed:", errorInfo)
  }

  function validateGPU(_, value) {
    const count = Number(value)
    const min = 1
    const max = gpu_count
    if (count < min || count > max) {
      return Promise.reject(t('task.train.gpu.invalid', { min, max }))
    }
    return Promise.resolve()
  }

  const getCheckedValue = (list) => list.find((item) => item.checked)["id"]
  const initialValues = {
    name: 'task_train_' + randomNumber(),
    train_sets: datasetIds,
    docker_image: image ? parseInt(image) : undefined,
    model: mid ? parseInt(mid) : undefined,
    train_type: getCheckedValue(TrainType()),
    network: getCheckedValue(FrameworkType()),
    backbone: getCheckedValue(Backbone()),
    gpu_count: 1,
  }
  return (
    <div className={commonStyles.wrapper}>
      <Breadcrumbs />
      <Card className={commonStyles.container} title={t('breadcrumbs.task.training')}>
        <div className={commonStyles.formContainer}>
          <Form
            name='trainForm'
            className={styles.form}
            {...formLayout}
            form={form}
            initialValues={initialValues}
            onFinish={onFinish}
            onFinishFailed={onFinishFailed}
            labelAlign={'left'}
            colon={false}
            scrollToFirstError
          >

            <Tip hidden={true}>
              <Form.Item
                label={t('task.filter.form.name.label')}
                name='name'
                rules={[
                  { required: true, whitespace: true, message: t('task.filter.form.name.placeholder') },
                  { type: 'string', min: 2, max: 50 },
                ]}
              >
                <Input placeholder={t('task.filter.form.name.required')} autoComplete='off' allowClear />
              </Form.Item>
            </Tip>

            <ConfigProvider renderEmpty={() => <EmptyState add={() => history.push('/home/dataset/add')} />}>
              <Tip hidden={true}>
                <Form.Item
                  label={t('task.train.form.trainsets.label')}
                  required
                  name="train_sets"
                  rules={[
                    { required: true, message: t('task.filter.form.datasets.required') },
                  ]}
                >
                  <Select
                    placeholder={t('task.filter.form.training.datasets.placeholder')}
                    mode='multiple'
                    filterOption={(input, option) => option.key.toLowerCase().indexOf(input.toLowerCase()) >= 0}
                    onChange={trainSetChange}
                    showArrow
                  >
                    {datasets.map(item => validationSets.indexOf(item.id) < 0 ? (
                      <Option value={item.id} key={item.name}>
                        {item.name}({item.asset_count})
                      </Option>
                    ) : null)}
                  </Select>
                </Form.Item>
              </Tip>
              <Tip content={t('tip.task.filter.testsets')}>
                <Form.Item
                  label={t('task.train.form.testsets.label')}
                  name="validation_sets"
                  rules={[
                    { required: true, message: t('task.filter.form.datasets.required') },
                  ]}
                >
                  <Select
                    placeholder={t('task.filter.form.test.datasets.placeholder')}
                    mode='multiple'
                    filterOption={(input, option) => option.key.toLowerCase().indexOf(input.toLowerCase()) >= 0}
                    onChange={validationSetChange}
                    showArrow
                  >
                    {datasets.map(item => trainSets.indexOf(item.id) < 0 ? (
                      <Option value={item.id} key={item.name}>
                        {item.name}({item.asset_count})
                      </Option>
                    ) : null)}
                  </Select>
                </Form.Item>
              </Tip>
            </ConfigProvider>

            <Tip hidden={true}>
              <Form.Item name='strategy'
                hidden={trainSets.length < 2 && validationSets.length < 2}
                initialValue={2} label={t('task.train.form.repeatdata.label')}>
                <Radio.Group options={[
                  { value: 2, label: t('task.train.form.repeatdata.latest') },
                  { value: 3, label: t('task.train.form.repeatdata.original') },
                  { value: 1, label: t('task.train.form.repeatdata.terminate') },
                ]} />
              </Form.Item>
            </Tip>

            <Tip hidden={true}>
              <Form.Item wrapperCol={{ offset: 8, span: 16 }} hidden={![...trainSets, ...validationSets].length}>
                <TripleRates
                  data={datasets}
                  parts={[
                    { ids: trainSets, label: t('task.train.form.trainsets.label') },
                    { ids: validationSets, label: t('task.train.form.testsets.label') },
                  ]}
                ></TripleRates>
              </Form.Item>
            </Tip>

            <Tip content={t('tip.task.filter.keywords')}>
              <Form.Item
                label={t('task.train.form.keywords.label')}
                name="keywords"
                dependencies={['model', 'train_sets', 'validation_sets']}
                rules={[
                  { required: true, message: t('task.train.form.keywords.required') },
                  { validator: validTrainTarget },
                ]}
              >
                <Select mode="multiple" showArrow
                  placeholder={t('task.train.keywords.placeholder')} onChange={(value) => setSelectedKeywords(value)}>
                  {keywords.map(keyword => (
                    <Option key={keyword} value={keyword}>
                      {keyword}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Tip>
            <Tip hidden={true}><Form.Item wrapperCol={{ offset: 8 }}><RecommendKeywords sets={trainSets} onSelect={selectRecommendKeywords} /></Form.Item></Tip>

            <ConfigProvider renderEmpty={() => <EmptyStateModel />}>
              <Tip content={t('tip.task.train.model')}>
                <Form.Item
                  label={t('task.mining.form.model.label')}
                  name="model"
                >
                  <ModelSelect placeholder={t('task.train.form.model.placeholder')} keywords={selectedKeywords}
                    onChange={modelChange} />
                </Form.Item>
              </Tip>
            </ConfigProvider>

            <Tip content={t('tip.task.train.image')}>
              <Form.Item name='docker_image' label={t('task.train.form.image.label')} rules={[
                { required: true, message: t('task.train.form.image.required') }
              ]}>
                <ImageSelect placeholder={t('task.train.form.image.placeholder')} onChange={imageChange} />
              </Form.Item>
            </Tip>

            <Tip hidden={true}>
              <Form.Item
                label={t('task.train.form.traintype.label')}
                name="train_type"
              >
                {renderRadio(TrainType())}
              </Form.Item>
            </Tip>

            <Tip hidden={true}>
              <Form.Item
                label={t('task.train.form.network.label')}
                name="network"
              >
                {renderRadio(FrameworkType())}
              </Form.Item>
            </Tip>

            <Tip hidden={true}>
              <Form.Item
                label={t('task.train.form.backbone.label')}
                name="backbone"
              >
                {renderRadio(Backbone())}
              </Form.Item>
            </Tip>

            <Tip content={t('tip.task.filter.gpucount')}>
              <Form.Item
                label={t('task.gpu.count')}
              >
                <Form.Item
                  noStyle
                  name="gpu_count"
                  rules={[
                    {validator: validateGPU}
                  ]}
                >
                  <InputNumber min={1} max={gpu_count} precision={0} /></Form.Item>
                <span style={{ marginLeft: 20 }}>{t('task.gpu.tip', { count: gpu_count })}</span>
              </Form.Item>
            </Tip>

            {seniorConfig.length ? <Tip content={t('tip.task.filter.hyperparams')}>
              <Form.Item
                label={t('task.train.form.hyperparam.label')}
                rules={[{ validator: validHyperparam }]}
              >
                <div>
                  <Button type='link'
                    onClick={() => setHpVisible(!hpVisible)}
                    icon={hpVisible ? <UpSquareOutlined /> : <DownSquareOutlined />}
                    style={{ paddingLeft: 0 }}
                  >{hpVisible ? t('task.train.fold') : t('task.train.unfold')}
                  </Button>
                </div>

                <Form.List name='hyperparam'>
                  {(fields, { add, remove }) => (
                    <>
                      <div className={styles.paramContainer} hidden={!hpVisible}>
                        <Row style={{ backgroundColor: '#fafafa', border: '1px solid #f4f4f4', lineHeight: '40px', marginBottom: 10 }} gutter={20}>
                          <Col flex={'240px'}>{t('common.key')}</Col>
                          <Col flex={1}>{t('common.value')}</Col>
                          <Col span={2}>{t('common.action')}</Col>
                        </Row>
                        {fields.map(field => (
                          <Row key={field.key} gutter={20}>
                            <Col flex={'240px'}>
                              <Form.Item
                                {...field}
                                // label="Key"
                                name={[field.name, 'key']}
                                fieldKey={[field.fieldKey, 'key']}
                                rules={[
                                  // {required: true, message: 'Missing Key'},
                                  { validator: validHyperparam }
                                ]}
                              >
                                <Input disabled={field.name < seniorConfig.length} allowClear maxLength={50} />
                              </Form.Item>
                            </Col>
                            <Col flex={1}>
                              <Form.Item
                                {...field}
                                // label="Value"
                                name={[field.name, 'value']}
                                fieldKey={[field.fieldKey, 'value']}
                                rules={[
                                  // {required: true, message: 'Missing Value'},
                                ]}
                              >
                                {seniorConfig[field.name] && typeof seniorConfig[field.name].value === 'number' ?
                                  <InputNumber maxLength={20} style={{ minWidth: '100%' }} /> : <Input allowClear maxLength={100} />}
                              </Form.Item>
                            </Col>
                            <Col span={2}>
                              <Space>
                                {field.name < seniorConfig.length ? null : <MinusCircleOutlined onClick={() => remove(field.name)} />}
                                {field.name === fields.length - 1 ? <PlusOutlined onClick={() => add()} title={t('task.train.parameter.add.label')} /> : null}
                              </Space>
                            </Col>
                          </Row>
                        ))}
                      </div>
                    </>
                  )}
                </Form.List>

              </Form.Item>
            </Tip> : null}
            <Tip hidden={true}>
              <Form.Item wrapperCol={{ offset: 8 }}>
                <Space size={20}>
                  <Form.Item name='submitBtn' noStyle>
                    <Button type="primary" size="large" htmlType="submit" disabled={!gpu_count}>
                      {t('task.filter.create')}
                    </Button>
                  </Form.Item>
                  <Form.Item name='backBtn' noStyle>
                    <Button size="large" onClick={() => history.goBack()}>
                      {t('task.btn.back')}
                    </Button>
                  </Form.Item>
                </Space>
              </Form.Item>
            </Tip>
          </Form>
        </div>
      </Card>
    </div>
  )
}

const dis = (dispatch) => {
  return {
    getDatasets(payload) {
      return dispatch({
        type: "dataset/getDatasets",
        payload,
      })
    },
    getSysInfo() {
      return dispatch({
        type: "common/getSysInfo",
      })
    },
    createTrainTask(payload) {
      return dispatch({
        type: "task/createTrainTask",
        payload,
      })
    },
  }
}

export default connect(null, dis)(Train)
