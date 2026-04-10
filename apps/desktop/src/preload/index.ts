import { contextBridge, ipcRenderer } from 'electron'

import type { IpcContractMap } from '@pecie/schemas'

type PecieApi = {
  invokeSafe: <TChannel extends keyof IpcContractMap>(
    channel: TChannel,
    payload: IpcContractMap[TChannel]['request']
  ) => Promise<IpcContractMap[TChannel]['response']>
}

const api: PecieApi = {
  invokeSafe: (channel, payload) => ipcRenderer.invoke(channel as string, payload)
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('pecie', api)
}
