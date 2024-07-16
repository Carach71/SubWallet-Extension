// Copyright 2019-2022 @subwallet/extension-base
// SPDX-License-Identifier: Apache-2.0

import { ExtrinsicType } from '@subwallet/extension-base/background/KoniTypes';
import { _getAppliedExistentialDeposit } from '@subwallet/extension-base/core/substrate/assets-pallet';
import BigN from 'bignumber.js';

export type PalletAssetsAssetAccount = {
  balance: number | string,
  status: 'Frozen' | 'Liquid' | 'Blocked',
  reason: Record<string, unknown>,
  extra: unknown
}

export function _getForeignAssetPalletTransferable (accountInfo: PalletAssetsAssetAccount | undefined, existentialDeposit: string, extrinsicType?: ExtrinsicType): string {
  const strictMode = !extrinsicType || ![ExtrinsicType.TRANSFER_TOKEN, ExtrinsicType.TRANSFER_BALANCE].includes(extrinsicType);

  if (!accountInfo || accountInfo.status !== 'Liquid') {
    return '0';
  }

  const bnAppliedExistentialDeposit = new BigN(_getAppliedExistentialDeposit(existentialDeposit, strictMode));
  const bnTransferable = new BigN(accountInfo.balance).minus(bnAppliedExistentialDeposit);

  return BigN.max(bnTransferable, 0).toFixed();
}

export function _getForeignAssetPalletLockedBalance (accountInfo: PalletAssetsAssetAccount | undefined): string {
  return !accountInfo || accountInfo.status === 'Liquid' ? '0' : new BigN(accountInfo.balance).toFixed();
}
