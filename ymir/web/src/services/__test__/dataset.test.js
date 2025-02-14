import {
  getDataset,
  getDatasets,
  batchDatasets,
  getAssetsOfDataset,
  getAsset,
  delDataset,
  createDataset,
  updateDataset,
  getInternalDataset,
} from "../dataset"
import { product, products, requestExample } from './func'

describe("service: dataset", () => {

  it("getDataset -> success", () => {
    const id = 641
    const expected = { id, name: 'datasetname00345' }
    requestExample(getDataset, id, expected, 'get')
  })
  it("getDataset -> params validate failed", () => {
    requestExample(getDataset, null, null, 'get', 1002)
  })

  it("getDatasets -> success -> all filter conditions", () => {
    const params = { name: 'searchname', type: 1, start_time: 0, end_time: 0, limit: 20, offset: 0 }
    const expected = products(4)

    requestExample(getDatasets, params, { items: expected, total: expected.length }, 'get')
  })

  it("getDatasets -> success -> filter name", () => {
    const params = { name: 'partofname' }
    const expected = products(2)

    requestExample(getDatasets, params, { items: expected, total: expected.length }, 'get')
  })

  it("getDatasets -> success -> none filter conditions", () => {
    const params = {}
    const expected = products(5)

    requestExample(getDatasets, params, { items: expected, total: expected.length }, 'get')
  })

  it("getDatasets -> success -> all filter conditions", () => {
    const params = { type: 1, start_time: 0, end_time: 0, limit: 20, offset: 40 }
    const expected = products(5)

    requestExample(getDatasets, params, { items: expected, total: expected.length }, 'get')
  })

  it("batchDatasets -> success", () => {
    const params = { ids: [1, 2, 3] }
    const expected = products(3)
    requestExample(batchDatasets, params, { items: expected, total: expected.length }, 'get')
  })

  it("delDataset -> success and ", () => {
    const id = 644
    const expected = { id }
    requestExample(delDataset, id, expected)
  })

  it('delDataset -> can not find resource', () => {
    requestExample(delDataset, null, null, null, 5001)
  })
  it("createDataset -> success", () => {
    const id = 646
    const datasets = { name: 'new dataset' }
    const expected = { id, ...datasets }
    requestExample(createDataset, datasets, expected, 'post')
  })
  it("createDataset -> create when user logouted", () => {
    const datasets = { name: 'new dataset' }
    requestExample(createDataset, datasets, null, 'post', 110104)
  })
  it("createDataset -> params validate failed", () => {
    requestExample(createDataset, null, null, 'post', 1002)
  })

  it("updateDataset -> success", () => {
    const id = 647
    const name = 'new name of dataset'
    const expected = { id, name }
    requestExample(updateDataset, [id, name], expected)
  })

  it("updateDataset -> dulplicated name", () => {
    const id = 648
    const name = 'dulplicated name'
    requestExample(updateDataset, [id, name], null, null, 4002)
  })

  it("updateDataset -> params validate failed", () => {
    requestExample(updateDataset, null, null, null, 4002)
  })

  it("getAssetsOfDataset -> success", () => {
    const params = { id: 642 }
    const expected = products(11)
    requestExample(getAssetsOfDataset, params, { items: expected, total: expected.length }, 'get')
  })

  it("getAssetsOfDataset -> success with keywords", () => {
    const params = { id: 642, keyword: 83, limit: 20, offset: 0, }
    const expected = products(7)
    requestExample(getAssetsOfDataset, params, { items: expected, total: expected.length }, 'get')
  })

  it("getAsset -> success", () => {
    const hash = "643"
    const expected = { hash, url: '/path/to/asset/image', annotations: [{ keyword: 'cat', box: [234, 34, 200, 403] }] }
    requestExample(getAsset, hash, expected, 'get')
  })

  it('getAsset -> can not find resource', () => {
    requestExample(getAsset, null, null, 'get', 5001)
  })

  it("getInternalDataset -> success", () => {
    const expected = products(11)
    requestExample(getInternalDataset, {}, { items: expected, total: expected.length }, 'get')
  })
})
