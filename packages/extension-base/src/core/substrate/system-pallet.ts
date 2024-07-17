// Copyright 2019-2022 @subwallet/extension-base
// SPDX-License-Identifier: Apache-2.0

import { ExtrinsicType } from '@subwallet/extension-base/background/KoniTypes';
import { BalanceAccountType, FrameSystemAccountInfo, FrameSystemAccountInfoV1, FrameSystemAccountInfoV2 } from '@subwallet/extension-base/core/substrate/types';
import { getMaxBigint, getStrictMode } from '@subwallet/extension-base/core/utils';

function isV1 (accountInfo: FrameSystemAccountInfo): accountInfo is FrameSystemAccountInfoV1 {
  return (accountInfo as FrameSystemAccountInfoV1).data.miscFrozen !== undefined && (accountInfo as FrameSystemAccountInfoV1).data.feeFrozen !== undefined;
}

export function _getSystemPalletTransferable (accountInfo: FrameSystemAccountInfo, existentialDeposit: string, extrinsicType?: ExtrinsicType): bigint {
  const strictMode = getStrictMode(BalanceAccountType.FrameSystemAccountInfo, extrinsicType); // always apply strict mode to keep account alive unless explicitly specified otherwise

  if (isV1(accountInfo)) {
    return _getSystemPalletTransferableV1(accountInfo, existentialDeposit, strictMode);
  } else {
    return _getSystemPalletTransferableV2(accountInfo, existentialDeposit, strictMode);
  }
}

export function _canAccountBeReaped (accountInfo: FrameSystemAccountInfo): boolean {
  return accountInfo.consumers === 0; // might need to check refCount
}

export function _isAccountActive (accountInfo: FrameSystemAccountInfo): boolean {
  return accountInfo.providers === 0 && accountInfo.consumers === 0;
}

export function _getSystemPalletTotalBalance (accountInfo: FrameSystemAccountInfo): bigint {
  if (isV1(accountInfo)) {
    return _getSystemPalletTotalBalanceV1(accountInfo);
  } else {
    return _getSystemPalletTotalBalanceV2(accountInfo);
  }
}

export function _getAppliedExistentialDepositWithExtrinsicType (accountInfo: FrameSystemAccountInfo, existentialDeposit: string, extrinsicType?: ExtrinsicType): bigint {
  const strictMode = getStrictMode(BalanceAccountType.FrameSystemAccountInfo, extrinsicType); // always apply strict mode to keep account alive unless explicitly specified otherwise

  return _getAppliedExistentialDeposit(accountInfo, existentialDeposit, strictMode);
}

// ----------------------------------------------------------------------

function _getAppliedExistentialDeposit (accountInfo: FrameSystemAccountInfo, existentialDeposit: string, strictMode?: boolean): bigint {
  const bnExistentialDeposit = BigInt(existentialDeposit);

  // strict mode will always apply existential deposit to keep account alive
  if (strictMode) {
    return bnExistentialDeposit;
  }

  return _canAccountBeReaped(accountInfo) ? 0n : bnExistentialDeposit; // account for ED here will go better with max transfer logic
}

function _getSystemPalletTransferableV2 (accountInfo: FrameSystemAccountInfoV2, existentialDeposit: string, strictMode?: boolean): bigint {
  const bnLocked = BigInt(accountInfo.data.frozen) - BigInt(accountInfo.data.reserved); // locked can go below 0 but this shouldn't matter
  const bnAppliedExistentialDeposit = _getAppliedExistentialDeposit(accountInfo, existentialDeposit, strictMode);

  return BigInt(accountInfo.data.free) - (getMaxBigint(bnLocked, bnAppliedExistentialDeposit));
}

function _getSystemPalletTotalBalanceV2 (accountInfo: FrameSystemAccountInfoV2): bigint {
  return BigInt(accountInfo.data.free) + BigInt(accountInfo.data.reserved);
}

function _getSystemPalletTransferableV1 (accountInfo: FrameSystemAccountInfoV1, existentialDeposit: string, strictMode?: boolean): bigint {
  const bnAppliedExistentialDeposit = BigInt(_getAppliedExistentialDeposit(accountInfo, existentialDeposit, strictMode));
  const bnAppliedFrozen = getMaxBigint(BigInt(accountInfo.data.feeFrozen), BigInt(accountInfo.data.miscFrozen));

  return BigInt(accountInfo.data.free) - (getMaxBigint(bnAppliedFrozen, bnAppliedExistentialDeposit));
}

function _getSystemPalletTotalBalanceV1 (accountInfo: FrameSystemAccountInfoV1): bigint {
  return BigInt(accountInfo.data.free) + BigInt(accountInfo.data.reserved);
}
