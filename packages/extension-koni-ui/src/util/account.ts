// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { _ChainInfo } from '@subwallet/chain-list/types';
import { NetworkJson } from '@subwallet/extension-base/background/KoniTypes';
import { AccountJson } from '@subwallet/extension-base/background/types';
import { _getChainSubstrateAddressPrefix, _isChainEvmCompatible } from '@subwallet/extension-base/services/chain-service/utils';
import { ALL_ACCOUNT_KEY } from '@subwallet/extension-koni-base/constants';
import { isAccountAll } from '@subwallet/extension-koni-base/utils';
import { MODE_CAN_SIGN, SIGN_MODE } from '@subwallet/extension-koni-ui/constants/signing';
import { AccountType } from '@subwallet/extension-koni-ui/types';
import { getNetworkKeyByGenesisHash } from '@subwallet/extension-koni-ui/util/getNetworkJsonByGenesisHash';
import { getLogoByNetworkKey } from '@subwallet/extension-koni-ui/util/index';
import reformatAddress from '@subwallet/extension-koni-ui/util/reformatAddress';
import { AccountInfoByNetwork } from '@subwallet/extension-koni-ui/util/types';

import { decodeAddress, encodeAddress, isEthereumAddress } from '@polkadot/util-crypto';

export function getAccountType (address: string): AccountType {
  return isAccountAll(address) ? 'ALL' : isEthereumAddress(address) ? 'ETHEREUM' : 'SUBSTRATE';
}

export const getAccountInfoByNetwork = (networkMap: Record<string, NetworkJson>, address: string, network: NetworkJson): AccountInfoByNetwork => {
  const networkKey = getNetworkKeyByGenesisHash(networkMap, network.genesisHash) || '';

  return {
    address,
    key: networkKey,
    networkKey,
    networkDisplayName: network.chain,
    networkPrefix: network.ss58Format,
    networkLogo: getLogoByNetworkKey(networkKey),
    networkIconTheme: network.isEthereum ? 'ethereum' : (network.icon || 'polkadot'),
    formattedAddress: reformatAddress(address, network.ss58Format, network.isEthereum)
  };
};

export const findAccountByAddress = (accounts: AccountJson[], address?: string): AccountJson | null => {
  try {
    if (!address) {
      return null;
    }

    const originAddress = isEthereumAddress(address) ? address : encodeAddress(decodeAddress(address));
    const result = accounts.find((account) => account.address.toLowerCase() === originAddress.toLowerCase());

    return result || null;
  } catch (e) {
    console.error('Fail to detect adddress', e);

    return null;
  }
};

export const getSignMode = (account: AccountJson | null | undefined): SIGN_MODE => {
  if (!account) {
    return SIGN_MODE.UNKNOWN;
  } else {
    if (account.address === ALL_ACCOUNT_KEY) {
      return SIGN_MODE.ALL_ACCOUNT;
    } else {
      if (account.isExternal) {
        if (account.isHardware) {
          return SIGN_MODE.LEDGER;
        } else if (account.isReadOnly) {
          return SIGN_MODE.READ_ONLY;
        } else {
          return SIGN_MODE.QR;
        }
      } else {
        return SIGN_MODE.PASSWORD;
      }
    }
  }
};

export const accountCanSign = (signMode: SIGN_MODE): boolean => {
  return MODE_CAN_SIGN.includes(signMode);
};

export const filterNotReadOnlyAccount = (accounts: AccountJson[]): AccountJson[] => {
  return accounts.filter((acc) => !acc.isReadOnly);
};

export const isNoAccount = (accounts: AccountJson[] | null): boolean => {
  return accounts ? !accounts.filter((acc) => acc.address !== ALL_ACCOUNT_KEY).length : false;
};

export const searchAccountFunction = (item: AccountJson, searchText: string): boolean => {
  return item.address.toLowerCase().includes(searchText.toLowerCase()) || (item.name || '').toLowerCase().includes(searchText.toLowerCase());
};

export const formatAccountAddress = (account: AccountJson, networkInfo: _ChainInfo | null): string => {
  const prefix = networkInfo && _getChainSubstrateAddressPrefix(networkInfo) !== -1 ? _getChainSubstrateAddressPrefix(networkInfo) : 42;
  const isEthereum = account.type === 'ethereum' || (!!networkInfo && _isChainEvmCompatible(networkInfo));

  return reformatAddress(account.address, prefix, isEthereum);
};
