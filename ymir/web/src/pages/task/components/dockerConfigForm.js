import { useState } from "react"
import { Col, Form, Input, InputNumber, Row, Space } from "antd"
import Panel from "@/components/form/panel"
import t from '@/utils/t'
import s from "./form.less"
import {
  PlusOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'

const DockerConfigForm = ({ form, seniorConfig }) => {
  const [visible, setVisible] = useState(false)

  async function validHyperparam(rule, value) {

    const params = form.getFieldValue('hyperparam').map(({ key }) => key)
      .filter(item => item && item.trim() && item === value)
    if (params.length > 1) {
      return Promise.reject(t('task.validator.same.param'))
    } else {
      return Promise.resolve()
    }
  }
  return seniorConfig.length ? 
    <Panel label={t('task.train.form.hyperparam.label')} visible={visible} setVisible={setVisible}>
      <Form.Item
        wrapperCol={{ span: 18 }}
        rules={[{ validator: validHyperparam }]}
      >
        <Form.List name='hyperparam'>
          {(fields, { add, remove }) => (
            <>
              <div className={s.paramContainer} hidden={!visible}>
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
    </Panel> : null
}

export default DockerConfigForm