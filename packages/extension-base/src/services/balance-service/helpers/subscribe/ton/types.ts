// Copyright 2019-2022 @subwallet/extension-base
// SPDX-License-Identifier: Apache-2.0

import { Cell } from '@ton/core';

export type Signer = (message: Cell) => Promise<Buffer>; // alibaba

export interface TxByMsgResponse {
  transactions: TxDetailInfo[]
}

interface TxDetailInfo {
  hash: string
  description: {
    compute_ph: {
      success: boolean
    },
    action: {
      success: boolean
    }
  }
  in_msg: Msg,
  out_msgs: Msg[]
}

interface Msg {
  hash: string,
  bounced: boolean
}
