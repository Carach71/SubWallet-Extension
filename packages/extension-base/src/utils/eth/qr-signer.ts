// Copyright 2019-2022 @subwallet/extension-base
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'ethers';
import { SignedTransaction } from 'web3-core';

import { hexStripPrefix, numberToHex } from '@polkadot/util';

import { hexToNumberString } from './common';

/**
 * NOTE: Use for signing transaction as a QR Signer
 * @deprecated
 * */
export class EvmQrTransaction {
  readonly nonce: string;
  readonly gasPrice: string;
  readonly gas: string;
  readonly to: string;
  readonly value: string;
  readonly data: string;
  readonly ethereumChainId: string;
  readonly isSafe: boolean;

  constructor (nonce: string,
    gasPrice: string,
    gas: string,
    to: string,
    value: string,
    data: string,
    ethereumChainId: string) {
    this.nonce = hexToNumberString(nonce);
    this.gasPrice = hexToNumberString(gasPrice);
    this.gas = hexToNumberString(gas);
    this.to = to;
    this.value = hexToNumberString(value);
    this.data = data || '';
    this.ethereumChainId = parseInt(ethereumChainId, 16).toString();
    this.isSafe = true;
  }
}

export const createTransactionFromRLP = (rlp: string): EvmQrTransaction | null => {
  try {
    const transaction = ethers.utils.parseTransaction(rlp);
    const nonce = transaction.nonce.toString(16);
    const gasPrice = transaction.gasPrice?.toHexString() || '';
    const gas = transaction.gasLimit.toHexString();
    const to = transaction.to || '';
    const value = transaction.value.toHexString();
    const data = transaction.data;
    const ethereumChainId = transaction.chainId.toString(16);

    return new EvmQrTransaction(nonce,
      gasPrice,
      gas,
      to,
      value,
      data,
      ethereumChainId);
  } catch (e) {
    console.log((e as Error).message);

    return null;
  }
};

export const signatureToHex = (sig: SignedTransaction): string => {
  const v = parseInt(sig.v);
  const r = hexStripPrefix(sig.r);
  const s = hexStripPrefix(sig.s);
  const hexR = r.length % 2 === 1 ? `0${r}` : r;
  const hexS = s.length % 2 === 1 ? `0${s}` : s;
  const hexV = hexStripPrefix(numberToHex(v));

  return hexR + hexS + hexV;
};
