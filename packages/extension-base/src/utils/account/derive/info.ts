// Copyright 2019-2022 @subwallet/extension-base authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { AccountMetadataData, AccountProxyMap, AccountProxyType, DeriveInfo, NextDerivePair } from '@subwallet/extension-base/types';
import { getDerivePath } from '@subwallet/keyring';
import { EthereumKeypairTypes, KeypairType, KeyringPair, KeyringPair$Meta, SubstrateKeypairType, SubstrateKeypairTypes } from '@subwallet/keyring/types';
import { keyring } from '@subwallet/ui-keyring';
import { t } from 'i18next';

import { assert } from '@polkadot/util';

import { validateEvmDerivationPath, validateOtherSubstrateDerivationPath, validateSr25519DerivationPath, validateTonDerivationPath, validateUnifiedDerivationPath } from './validate';

export const parseUnifiedSuriToDerivationPath = (suri: string, type: KeypairType): string => {
  const reg = /^\/\/(\d+)(\/\/\d+)?$/;

  if (suri.match(reg)) {
    const [, firstIndex, secondData] = suri.match(reg) as string[];
    const first = parseInt(firstIndex, 10);

    if (secondData) {
      const [, secondIndex] = secondData.match(/\/\/(\d+)/) as string[];

      if (type === 'ethereum') {
        return `m/44'/60'/0'/0/${first}/${secondIndex}`;
      } else if (type === 'ton') {
        return `m/44'/607'/${first}'/${secondIndex}'`;
      }
    } else {
      if (type === 'ethereum') {
        return `m/44'/60'/0'/0/${first}`;
      } else if (type === 'ton') {
        return `m/44'/607'/${first}'`;
      }
    }

    if (SubstrateKeypairTypes.includes(type)) {
      return suri;
    }
  }

  return '';
};

export const getDerivationInfo = (type: KeypairType, _metadata?: KeyringPair$Meta): DeriveInfo => {
  const metadata: AccountMetadataData = _metadata || {};
  const { derivationPath: derivePath, parentAddress, suri } = metadata;

  if (suri) {
    if (derivePath) {
      const validateTypeFunc = type === 'ethereum'
        ? validateEvmDerivationPath
        : type === 'ton'
          ? validateTonDerivationPath
          : () => undefined;
      const validateTypeRs = validateTypeFunc(derivePath);

      if (validateTypeRs) {
        return {
          suri: validateTypeRs.suri,
          depth: validateTypeRs.depth,
          derivationPath: derivePath,
          parentAddress,
          autoIndexes: validateTypeRs.autoIndexes
        };
      } else {
        return {
          depth: 1,
          derivationPath: derivePath,
          parentAddress,
          suri
        };
      }
    } else {
      if (SubstrateKeypairTypes.includes(type)) {
        const _type = type as SubstrateKeypairType;
        const validateTypeFunc = _type === 'sr25519' ? validateSr25519DerivationPath : (raw: string) => validateOtherSubstrateDerivationPath(raw, _type);
        const validateTypeRs = validateTypeFunc(suri);

        if (validateTypeRs) {
          return {
            suri: validateTypeRs.suri,
            depth: validateTypeRs.depth,
            parentAddress,
            autoIndexes: validateTypeRs.autoIndexes
          };
        }
      }

      const validateUnifiedRs = validateUnifiedDerivationPath(suri);

      if (validateUnifiedRs) {
        const { autoIndexes, depth } = validateUnifiedRs;
        const derivationPath = parseUnifiedSuriToDerivationPath(suri, type);

        return {
          suri: suri,
          depth,
          derivationPath: derivationPath,
          parentAddress,
          autoIndexes
        };
      } else {
        return {
          depth: 1,
          derivationPath: derivePath,
          parentAddress,
          suri
        };
      }
    }
  } else {
    if (derivePath) {
      const validateTypeFunc = type === 'ethereum'
        ? validateEvmDerivationPath
        : type === 'ton'
          ? validateTonDerivationPath
          : () => undefined;
      const validateTypeRs = validateTypeFunc(derivePath);

      if (validateTypeRs) {
        return {
          suri: validateTypeRs.suri,
          depth: validateTypeRs.depth,
          derivationPath: derivePath,
          parentAddress,
          autoIndexes: validateTypeRs.autoIndexes
        };
      } else {
        return {
          depth: 1,
          derivationPath: derivePath,
          parentAddress,
          suri
        };
      }
    }
  }

  return {
    depth: 0,
    parentAddress,
    suri: suri
  };
};

/**
 * @func findNextDerivePair
 * @return {NextDerivePair}
 * */
export const findNextDerivePair = (parentAddress: string): NextDerivePair => {
  let parentPair: KeyringPair | undefined;

  try {
    parentPair = keyring.getPair(parentAddress);
  } catch (e) {

  }

  assert(parentPair, t('Unable to find account'));

  const deriveInfo = getDerivationInfo(parentPair.type, parentPair.meta);
  const needChangeRoot = (parentPair.type === 'ethereum' || parentPair.type === 'ton') && deriveInfo.depth > 0;
  let rootPair: KeyringPair | undefined;

  if (needChangeRoot) {
    try {
      rootPair = keyring.getPair(parentPair.meta.parentAddress as string || '');
    } catch (e) {

    }
  } else {
    rootPair = parentPair;
  }

  assert(rootPair, t('Unable to find parent account'));

  const rootAddress = rootPair.address;
  const currentDepth = deriveInfo.depth;
  const currentIndex = deriveInfo.autoIndexes?.[currentDepth - 1];
  const pairs = keyring.getPairs();
  const children = pairs.filter((p) => p.meta.parentAddress === rootAddress);
  const childrenMetadata = children
    .map(({ meta, type }) => getDerivationInfo(type, meta))
    .filter(({ autoIndexes, depth }) => {
      return depth === currentDepth + 1 && currentIndex === autoIndexes?.[currentDepth - 1];
    })
    .sort((a, b) => {
      const aDeriveIndex = a.autoIndexes?.[currentDepth];
      const bDeriveIndex = b.autoIndexes?.[currentDepth];

      if (aDeriveIndex !== undefined && bDeriveIndex !== undefined) {
        return aDeriveIndex - bDeriveIndex;
      } else {
        if (aDeriveIndex === undefined && bDeriveIndex === undefined) {
          return 0;
        } else {
          return aDeriveIndex === undefined ? 1 : -1;
        }
      }
    });

  let index = currentDepth === 0 ? 1 : 0;

  for (const { autoIndexes, suri } of childrenMetadata) {
    const _autoIndexes = autoIndexes as number[];
    const deriveIndex = _autoIndexes[currentDepth];

    if (!suri || deriveIndex === undefined) {
      break;
    }

    if (deriveIndex === index) {
      index++;
    } else {
      break;
    }
  }

  const isSubstrate = SubstrateKeypairTypes.includes(parentPair.type);

  const indexes: number[] = currentDepth > 0 ? (deriveInfo.autoIndexes || []) as number[] : [];

  indexes.push(index);

  const suri = isSubstrate ? `//${index}` : '//'.concat(indexes.join('//'));

  return {
    deriveIndex: index,
    depth: currentDepth + 1,
    derivationPath: parseUnifiedSuriToDerivationPath(suri, rootPair.type),
    suri,
    deriveAddress: rootAddress
  };
};

export const getUnifiedDerivationInfo = (suri?: string): DeriveInfo => {
  if (suri) {
    const validateUnifiedRs = validateUnifiedDerivationPath(suri);

    if (validateUnifiedRs) {
      const { autoIndexes, depth } = validateUnifiedRs;

      return {
        suri: suri,
        depth,
        autoIndexes
      };
    }
  }

  return {
    depth: 0,
    suri
  };
};

/**
 * @func findNextDeriveUnified
 * @return {NextDerivePair}
 * */
export const findNextDeriveUnified = (proxyId: string, accounts: AccountProxyMap): NextDerivePair => {
  const currentProxy = accounts[proxyId];
  const parentProxyId = currentProxy.parentId || currentProxy.id;
  const parentProxy = accounts[parentProxyId];
  const deriveInfo = getUnifiedDerivationInfo(currentProxy.suri);
  const currentDepth = deriveInfo.depth;
  const currentIndex = deriveInfo.autoIndexes?.[currentDepth - 1];
  const children = parentProxy.children?.map((id) => accounts[id]).filter((child) => child.accountType === AccountProxyType.UNIFIED) || [];
  const childrenMetadata = children
    .map(({ suri }) => getUnifiedDerivationInfo(suri))
    .filter(({ autoIndexes, depth }) => {
      return depth === currentDepth + 1 && currentIndex === autoIndexes?.[currentDepth - 1];
    })
    .sort((a, b) => {
      const aDeriveIndex = a.autoIndexes?.[currentDepth];
      const bDeriveIndex = b.autoIndexes?.[currentDepth];

      if (aDeriveIndex !== undefined && bDeriveIndex !== undefined) {
        return aDeriveIndex - bDeriveIndex;
      } else {
        if (aDeriveIndex === undefined && bDeriveIndex === undefined) {
          return 0;
        } else {
          return aDeriveIndex === undefined ? 1 : -1;
        }
      }
    });

  let index = currentDepth === 0 ? 1 : 0;

  for (const { autoIndexes, suri } of childrenMetadata) {
    const _autoIndexes = autoIndexes as number[];
    const deriveIndex = _autoIndexes[currentDepth];

    if (!suri || deriveIndex === undefined) {
      break;
    }

    if (deriveIndex === index) {
      index++;
    } else {
      break;
    }
  }

  const indexes: number[] = currentDepth > 0 ? (deriveInfo.autoIndexes || []) as number[] : [];

  indexes.push(index);

  const suri = '//'.concat(indexes.join('//'));

  return {
    deriveIndex: index,
    depth: currentDepth + 1,
    suri,
    deriveAddress: parentProxy.id
  };
};

export const derivePair = (parentPair: KeyringPair, name: string, suri: string, derivationPath?: string): KeyringPair => {
  if (parentPair.isLocked) {
    keyring.unlockPair(parentPair.address);
  }

  const isEvm = EthereumKeypairTypes.includes(parentPair.type);
  const isTon = parentPair.type === 'ton';

  const meta = {
    name,
    parentAddress: parentPair.address,
    suri: suri,
    derivationPath
  };

  if (derivationPath && (isEvm || isTon)) {
    return isEvm ? parentPair.evm.deriveCustom(derivationPath, meta) : parentPair.ton.deriveCustom(derivationPath, meta);
  } else {
    return parentPair.substrate.derive(suri, meta);
  }
};

export const getSuri = (seed: string, type?: KeypairType): string => {
  const extraPath = type ? getDerivePath(type)(0) : '';

  return seed + (extraPath ? '/' + extraPath : '');
};
