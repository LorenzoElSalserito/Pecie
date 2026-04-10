/// <reference types="vite/client" />

import type { IpcContractMap } from '@pecie/schemas'

type PecieApi = {
  invokeSafe: <TChannel extends keyof IpcContractMap>(
    channel: TChannel,
    payload: IpcContractMap[TChannel]['request']
  ) => Promise<IpcContractMap[TChannel]['response']>
}

declare global {
  interface Window {
    pecie: PecieApi
  }
}

export {}
