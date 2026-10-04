import { contextBridge } from 'electron'
import type { JoopjoopApi } from '@shared/api'

// renderer에는 이 객체에 정의한 함수만 노출한다. ipcRenderer를 통째로 노출하지 않는다.
const api: JoopjoopApi = {}

contextBridge.exposeInMainWorld('api', api)
