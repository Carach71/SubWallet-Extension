// Copyright 2019-2022 @subwallet/extension-base
// SPDX-License-Identifier: Apache-2.0

import { Asset, SwapSDK } from '@chainflip/sdk/swap';
import { _ChainAsset } from '@subwallet/chain-list/types';
import { SwapError } from '@subwallet/extension-base/background/errors/SwapError';
import { TransactionError } from '@subwallet/extension-base/background/errors/TransactionError';
import { ChainService } from '@subwallet/extension-base/services/chain-service';
import { SwapBaseHandler } from '@subwallet/extension-base/services/swap-service/handler/base-handler';
import { calculateSwapRate, CHAIN_FLIP_SUPPORTED_ASSET_MAPPING, CHAIN_FLIP_SUPPORTED_CHAIN_MAPPING, chainFlipConvertChainId, DEFAULT_SWAP_FIRST_STEP, MOCK_SWAP_FEE, SWAP_QUOTE_TIMEOUT_MAP } from '@subwallet/extension-base/services/swap-service/utils';
import { OptimalSwapPath, OptimalSwapPathParams, SwapEarlyValidation, SwapErrorType, SwapFeeComponent, SwapFeeType, SwapQuote, SwapRequest, SwapStepType, ValidateSwapProcessParams } from '@subwallet/extension-base/types/swap';
import BigN from 'bignumber.js';

interface ChainflipPreValidationMetadata {
  minSwap: string;
  maxSwap?: string;
}

enum ChainflipFeeType {
  INGRESS = 'INGRESS',
  NETWORK = 'NETWORK',
  EGRESS = 'EGRESS',
  LIQUIDITY = 'LIQUIDITY'
}

const INTERMEDIARY_ASSET_SLUG = 'ethereum-ERC20-USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

export class ChainflipSwapHandler extends SwapBaseHandler {
  private swapSdk: SwapSDK;
  private chainService: ChainService;

  constructor (providerSlug: string, providerName: string, chainService: ChainService) {
    super(providerSlug, providerName);

    this.swapSdk = new SwapSDK({
      network: 'mainnet'
    });
    this.chainService = chainService;
  }

  protected async validateSwapRequest (request: SwapRequest): Promise<SwapEarlyValidation> {
    try {
      // todo: risk of matching wrong chain, asset can lead to loss of funds

      const fromAsset = this.chainService.getAssetBySlug(request.pair.from);
      const toAsset = this.chainService.getAssetBySlug(request.pair.to);
      const srcChain = fromAsset.originChain;
      const destChain = toAsset.originChain;

      const bnAmount = new BigN(request.fromAmount);

      const srcChainId = CHAIN_FLIP_SUPPORTED_CHAIN_MAPPING[srcChain];
      const destChainId = CHAIN_FLIP_SUPPORTED_CHAIN_MAPPING[destChain];

      const fromAssetId = CHAIN_FLIP_SUPPORTED_ASSET_MAPPING[fromAsset.slug];
      const toAssetId = CHAIN_FLIP_SUPPORTED_ASSET_MAPPING[toAsset.slug];

      if (!srcChainId || !destChainId || !fromAssetId || !toAssetId) {
        return {
          error: SwapErrorType.ASSET_NOT_SUPPORTED
        };
      }

      const [supportedDestChains, srcAssets, destAssets] = await Promise.all([
        this.swapSdk.getChains(srcChainId),
        this.swapSdk.getAssets(srcChainId),
        this.swapSdk.getAssets(destChainId)
      ]);

      const supportedDestChainId = supportedDestChains.find((c) => c.chain === destChainId);
      const srcAssetData = srcAssets.find((a) => a.asset === fromAssetId);
      const destAssetData = destAssets.find((a) => a.asset === toAssetId);

      if (!destAssetData || !srcAssetData || !supportedDestChainId) {
        return { error: SwapErrorType.ASSET_NOT_SUPPORTED };
      }

      const bnMinSwap = new BigN(srcAssetData.minimumSwapAmount);

      if (bnAmount.lt(bnMinSwap)) {
        return {
          error: SwapErrorType.NOT_MEET_MIN_SWAP,
          metadata: {
            minSwap: srcAssetData.minimumSwapAmount,
            maxSwap: srcAssetData.maximumSwapAmount
          } as ChainflipPreValidationMetadata
        };
      }

      if (srcAssetData.maximumSwapAmount) {
        const bnMaxSwap = new BigN(srcAssetData.maximumSwapAmount);

        if (bnAmount.gt(bnMaxSwap)) {
          return {
            error: SwapErrorType.EXCEED_MAX_SWAP,
            metadata: {
              minSwap: srcAssetData.minimumSwapAmount,
              maxSwap: srcAssetData.maximumSwapAmount
            } as ChainflipPreValidationMetadata
          };
        }
      }

      return {
        metadata: {
          minSwap: srcAssetData.minimumSwapAmount,
          maxSwap: srcAssetData.maximumSwapAmount
        } as ChainflipPreValidationMetadata
      };
    } catch (e) {
      console.log('Error validating swap request', e);

      return { error: SwapErrorType.UNKNOWN };
    }
  }

  private parseSwapPath (fromAsset: _ChainAsset, toAsset: _ChainAsset) {
    if (toAsset.slug !== INTERMEDIARY_ASSET_SLUG) { // Chainflip always use USDC as intermediary
      return [fromAsset.slug, INTERMEDIARY_ASSET_SLUG, toAsset.slug]; // todo: generalize this
    }

    return [fromAsset.slug, toAsset.slug];
  }

  public async getSwapQuote (request: SwapRequest): Promise<SwapQuote | SwapError> {
    const fromAsset = this.chainService.getAssetBySlug(request.pair.from);
    const toAsset = this.chainService.getAssetBySlug(request.pair.to);

    if (!fromAsset || !toAsset) {
      return new SwapError(SwapErrorType.UNKNOWN);
    }

    const earlyValidation = await this.validateSwapRequest(request);
    const metadata = earlyValidation.metadata as ChainflipPreValidationMetadata;

    if (earlyValidation.error) {
      return new SwapError(earlyValidation.error);
    }

    try {
      const quoteResponse = await this.swapSdk.getQuote({
        srcChain: chainFlipConvertChainId(fromAsset.originChain),
        amount: request.fromAmount,
        destChain: chainFlipConvertChainId(toAsset.originChain),
        srcAsset: fromAsset.symbol as Asset,
        destAsset: toAsset.symbol as Asset
      });

      const feeComponent: SwapFeeComponent[] = [];

      // todo: handle route
      // todo: handle fees, filter and aggregate by tokens, NOT calculate total fee value
      quoteResponse.quote.includedFees.forEach((fee) => {
        switch (fee.type) {
          case ChainflipFeeType.INGRESS:
          case ChainflipFeeType.NETWORK:

          // eslint-disable-next-line no-fallthrough
          case ChainflipFeeType.EGRESS: {
            const tokenSlug = Object.keys(CHAIN_FLIP_SUPPORTED_ASSET_MAPPING).find((assetSlug) => CHAIN_FLIP_SUPPORTED_ASSET_MAPPING[assetSlug] === fee.asset) as string;

            feeComponent.push({
              tokenSlug,
              amount: fee.amount,
              feeType: SwapFeeType.NETWORK_FEE
            });
            break;
          }

          case ChainflipFeeType.LIQUIDITY: {
            const tokenSlug = Object.keys(CHAIN_FLIP_SUPPORTED_ASSET_MAPPING).find((assetSlug) => CHAIN_FLIP_SUPPORTED_ASSET_MAPPING[assetSlug] === fee.asset) as string;

            feeComponent.push({
              tokenSlug,
              amount: fee.amount,
              feeType: SwapFeeType.PLATFORM_FEE
            });
            break;
          }
        }
      });

      // const depositAddress = await this.swapSdk.requestDepositAddress({
      //   srcChain: chainFlipConvertChainId(fromAsset.originChain),
      //   destChain: chainFlipConvertChainId(toAsset.originChain),
      //   srcAsset: fromAsset.symbol as Asset,
      //   destAsset: toAsset.symbol as Asset,
      //   destAddress: request.address,
      //   amount: request.fromAmount
      // });
      //
      // console.log('depositAddress', depositAddress);

      return {
        pair: request.pair,
        fromAmount: request.fromAmount,
        toAmount: quoteResponse.quote.egressAmount.toString(),
        rate: calculateSwapRate(request.fromAmount, quoteResponse.quote.egressAmount.toString(), fromAsset, toAsset),
        provider: this.providerInfo,
        aliveUntil: +Date.now() + SWAP_QUOTE_TIMEOUT_MAP[this.slug],
        minSwap: metadata.minSwap,
        maxSwap: metadata.maxSwap,
        feeInfo: {
          feeComponent: feeComponent,
          defaultFeeToken: fromAsset.slug, // todo
          feeOptions: [fromAsset.slug] // todo
        },
        route: {
          path: this.parseSwapPath(fromAsset, toAsset)
        }
      } as SwapQuote;
    } catch (e) {
      console.error('Error getting quote from Chainflip', e);
      // todo: handle more error from chainflip

      return new SwapError(SwapErrorType.ERROR_FETCHING_QUOTE);
    }
  }

  public validateSwapProcess (params: ValidateSwapProcessParams): Promise<TransactionError[]> {
    return Promise.resolve([]);
  }

  generateOptimalProcess (params: OptimalSwapPathParams): Promise<OptimalSwapPath> {
    const result: OptimalSwapPath = {
      totalFee: [MOCK_SWAP_FEE],
      steps: [DEFAULT_SWAP_FIRST_STEP]
    };

    if (params.selectedQuote) {
      result.totalFee.push(params.selectedQuote.feeInfo);
      result.steps.push({
        id: result.steps.length,
        name: 'Swap',
        type: SwapStepType.SWAP
      });
    } else { // todo: improve this
      result.totalFee.push({
        feeComponent: [],
        defaultFeeToken: params.request.pair.from
      });
      result.steps.push({
        id: result.steps.length,
        name: 'Swap',
        type: SwapStepType.SWAP
      });
    }

    return Promise.resolve(result);
  }
}