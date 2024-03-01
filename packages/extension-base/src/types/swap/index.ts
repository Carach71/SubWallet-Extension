// Copyright 2019-2022 @subwallet/extension-base
// SPDX-License-Identifier: Apache-2.0

import { SwapError } from '@subwallet/extension-base/background/errors/SwapError';
import {ChainType, ExtrinsicType} from '@subwallet/extension-base/background/KoniTypes';
import { TransactionData } from '@subwallet/extension-base/types';
import { BaseStepDetail } from '@subwallet/extension-base/types/service-base';

// core
export type SwapRate = number;

export interface SwapPair {
  slug: string;
  from: string;
  to: string;
}

export interface SwapQuote {
  pair: SwapPair;
  fromAmount: string;
  toAmount: string;
  rate: SwapRate; // rate = fromToken / toToken
  provider: SwapProvider;
  aliveUntil: number; // timestamp
  route: SwapRoute;

  minSwap?: string; // min amount to start swapping
  maxSwap?: string; // set by the provider

  feeInfo: SwapFeeInfo;
}

export interface SwapRoute {
  path: string[]; // list of tokenSlug
  // todo: there might be more info
}

export enum SwapErrorType {
  ERROR_FETCHING_QUOTE = 'ERROR_FETCHING_QUOTE',
  NOT_MEET_MIN_SWAP = 'NOT_MEET_MIN_SWAP',
  EXCEED_MAX_SWAP = 'EXCEED_MAX_SWAP',
  NO_AVAILABLE_PROVIDER = 'NO_AVAILABLE_PROVIDER',
  UNKNOWN = 'UNKNOWN',
  ASSET_NOT_SUPPORTED = 'ASSET_NOT_SUPPORTED'
}

export enum SwapStepType {
  DEFAULT = 'DEFAULT',
  TOKEN_APPROVAL = 'TOKEN_APPROVAL',
  SWAP = 'SWAP'
}

export enum SwapProviderId {
  CHAIN_FLIP = 'CHAIN_FLIP'
}

export const _SUPPORTED_SWAP_PROVIDERS = ['CHAIN_FLIP'];

export interface SwapProvider {
  id: SwapProviderId;
  name: string;

  faq?: string;
}

// process handling
export enum SwapFeeType {
  PLATFORM_FEE = 'PLATFORM_FEE',
  NETWORK_FEE = 'NETWORK_FEE',
  WALLET_FEE = 'WALLET_FEE'
}

export interface SwapFeeComponent {
  feeType: SwapFeeType;
  amount: string;
  tokenSlug: string;
}

export interface SwapFeeInfo {
  feeComponent: SwapFeeComponent[];
  defaultFeeToken: string;
  feeOptions?: string[]; // list of tokenSlug
}

export interface SwapStepDetail extends BaseStepDetail {
  id: number;
}

export interface OptimalSwapPath { // path means the steps to complete the swap, not the quote itself
  totalFee: SwapFeeInfo[]; // each item in the array is tx fee for a step
  steps: SwapStepDetail[];
}

// parameters & responses
export interface QuoteAskResponse {
  quote?: SwapQuote;
  error?: SwapError;
}

export interface SwapRequest {
  address: string;
  pair: SwapPair;
  fromAmount: string;
  slippage: number; // Example: 0.01 for 1%
  recipient?: string;
}

export interface SwapRequestResult {
  process: OptimalSwapPath;
  quote: SwapQuoteResponse;
}

export interface SwapQuoteResponse {
  optimalQuote?: SwapQuote; // if no optimalQuote then there's an error
  quotes: SwapQuote[];
  aliveUntil: number; // timestamp
  error?: SwapError; // only if there's no available quote
}

export interface SwapSubmitParams {
  process: OptimalSwapPath;
  currentStep: number;
  quote: SwapQuote;
  address: string;
  slippage: number; // Example: 0.01 for 1%
  recipient?: string;
}

export interface SwapSubmitStepData {
  txChain: string;
  txData: any;
  extrinsic: TransactionData;
  transferNativeAmount: string;
  extrinsicType: ExtrinsicType;
  chainType: ChainType
}

export interface OptimalSwapPathParams {
  request: SwapRequest;
  selectedQuote?: SwapQuote;
}

export interface SwapEarlyValidation {
  error?: SwapErrorType;
  metadata?: unknown;
}

export interface ValidateSwapProcessParams {
  address: string;
  process: OptimalSwapPath;
  selectedQuote: SwapQuote;
}