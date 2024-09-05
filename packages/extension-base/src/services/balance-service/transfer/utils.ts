// Copyright 2019-2022 @subwallet/extension-base
// SPDX-License-Identifier: Apache-2.0

import { ChainInfoMap } from '@subwallet/chain-list';
import { ActionType, LEDGER_GENERIC_ALLOW_NETWORKS, ledgerMustCheckNetwork, ValidationCondition } from '@subwallet/extension-base/services/balance-service/transfer/types';
import { _isChainEvmCompatible, _isChainSubstrateCompatible, _isChainTonCompatible } from '@subwallet/extension-base/services/chain-service/utils';
import { AccountJson } from '@subwallet/extension-base/types';
import { detectTranslate, isAddressAndChainCompatible, isSameAddress, reformatAddress } from '@subwallet/extension-base/utils';
import { isAddress, isTonAddress } from '@subwallet/keyring';

import { isEthereumAddress } from '@polkadot/util-crypto';

function getConditions (srcChain: string, destChain: string, fromAddress: string, toAddress: string, account: AccountJson | null, actionType: ActionType): ValidationCondition[] {
  const conditions: ValidationCondition[] = [];
  const isSendAction = [ActionType.SEND_FUND, ActionType.SEND_NFT].includes(actionType);

  conditions.push(ValidationCondition.IS_NOT_NULL);
  conditions.push(ValidationCondition.IS_ADDRESS);
  conditions.push(ValidationCondition.IS_VALID_ADDRESS);

  if (!isEthereumAddress(toAddress) && !isTonAddress(toAddress)) {
    // todo: need isSubstrateAddress util function to check exactly
    // todo: add check advanced detection button
    conditions.push(ValidationCondition.IS_VALID_SUBSTRATE_ADDRESS_FORMAT);
  }

  if (srcChain === destChain && isSendAction && !ChainInfoMap[destChain].tonInfo) {
    conditions.push(ValidationCondition.IS_NOT_DUPLICATE_ADDRESS);
  }

  if (account?.isHardware) {
    conditions.push(ValidationCondition.IS_SUPPORT_LEDGER_ACCOUNT);
  }

  return conditions;
}

function getValidation (conditions: ValidationCondition[], srcChain: string, destChain: string, fromAddress: string, toAddress: string, account: AccountJson | null, actionType: ActionType): Promise<void> {
  const destChainInfo = ChainInfoMap[destChain];

  for (const condition of conditions) {
    switch (condition) {
      case ValidationCondition.IS_NOT_NULL: {
        if (!toAddress) {
          return Promise.reject(detectTranslate('Recipient address is required'));
        }

        break;
      }

      case ValidationCondition.IS_ADDRESS: {
        if (!isAddress(toAddress)) {
          return Promise.reject(detectTranslate('Invalid recipient address'));
        }

        break;
      }

      case ValidationCondition.IS_VALID_ADDRESS: {
        if (!isAddressAndChainCompatible(toAddress, destChainInfo)) {
          if (_isChainEvmCompatible(destChainInfo)) {
            return Promise.reject(detectTranslate('The recipient address must be EVM type'));
          }

          if (_isChainSubstrateCompatible(destChainInfo)) {
            return Promise.reject(detectTranslate('The recipient address must be Substrate type'));
          }

          if (_isChainTonCompatible(destChainInfo)) {
            return Promise.reject(detectTranslate('The recipient address must be Ton type'));
          }

          return Promise.reject(detectTranslate('Unknown chain type'));
        }

        break;
      }

      case ValidationCondition.IS_VALID_SUBSTRATE_ADDRESS_FORMAT: {
        const addressPrefix = destChainInfo?.substrateInfo?.addressPrefix ?? 42;
        const toAddressFormatted = reformatAddress(toAddress, addressPrefix);

        if (toAddressFormatted !== toAddress) {
          return Promise.reject(detectTranslate(`Recipient should be a valid ${destChainInfo.name} address`));
        }

        break;
      }

      case ValidationCondition.IS_NOT_DUPLICATE_ADDRESS: {
        if (isSameAddress(fromAddress, toAddress)) {
          return Promise.reject(detectTranslate('The recipient address can not be the same as the sender address'));
        }

        break;
      }

      case ValidationCondition.IS_SUPPORT_LEDGER_ACCOUNT: {
        const ledgerCheck = ledgerMustCheckNetwork(account);

        if (ledgerCheck !== 'unnecessary' && !LEDGER_GENERIC_ALLOW_NETWORKS.includes(destChainInfo.slug)) {
          return Promise.reject(detectTranslate(`Ledger ${ledgerCheck === 'polkadot' ? 'Polkadot' : 'Migration'} address is not supported for this transfer`));
        }

        break;
      }
    }
  }

  return Promise.resolve();
}

export function validateRecipientAddress (srcChain: string, destChain: string, fromAddress: string, toAddress: string, account: AccountJson | null, actionType: ActionType): Promise<void> {
  const conditions = getConditions(srcChain, destChain, fromAddress, toAddress, account, actionType);

  return getValidation(conditions, srcChain, destChain, fromAddress, toAddress, account, actionType);
}
