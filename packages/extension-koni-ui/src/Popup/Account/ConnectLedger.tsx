// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { LedgerNetwork } from '@subwallet/extension-base/background/KoniTypes';
import { reformatAddress } from '@subwallet/extension-base/utils';
import { AccountItemWithName, AccountWithNameSkeleton, BasicOnChangeFunction, ChainSelector, CloseIcon, DualLogo, Layout, PageWrapper } from '@subwallet/extension-koni-ui/components';
import { ATTACH_ACCOUNT_MODAL, SUBSTRATE_MIGRATION_KEY } from '@subwallet/extension-koni-ui/constants';
import { useAutoNavigateToCreatePassword, useCompleteCreateAccount, useDefaultNavigate, useGetSupportedLedger, useGoBackFromCreateAccount, useLedger } from '@subwallet/extension-koni-ui/hooks';
import { createAccountHardwareMultiple } from '@subwallet/extension-koni-ui/messaging';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { ChainItemType, ThemeProps } from '@subwallet/extension-koni-ui/types';
import { BackgroundIcon, Button, Icon, Image, ModalContext, SwList } from '@subwallet/react-ui';
import CN from 'classnames';
import { CheckCircle, CircleNotch, Swatches } from 'phosphor-react';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import DefaultLogosMap from '../../assets/logo';

type Props = ThemeProps;

interface ImportLedgerItem {
  accountIndex: number;
  address: string;
  name: string;
}

const LIMIT_PER_PAGE = 5;

const FooterIcon = (
  <Icon
    phosphorIcon={Swatches}
    weight='fill'
  />
);

const MigrateChainSelectModalId = 'migrate-chain-modal-select-id';

const Component: React.FC<Props> = (props: Props) => {
  useAutoNavigateToCreatePassword();

  const { className } = props;

  const { t } = useTranslation();
  const { goHome } = useDefaultNavigate();

  const [supportedLedger, migrationSupportedLedger] = useGetSupportedLedger();
  const onComplete = useCompleteCreateAccount();
  const onBack = useGoBackFromCreateAccount(ATTACH_ACCOUNT_MODAL);

  const { accounts } = useSelector((state: RootState) => state.accountState);
  const { activeModal, checkActive } = useContext(ModalContext);

  const [chain, setChain] = useState(supportedLedger[0].slug);
  const [migrateChain, setMigrateChain] = useState(migrationSupportedLedger[0].slug);
  const [ledgerAccounts, setLedgerAccounts] = useState<Array<ImportLedgerItem | null>>([]);
  const [firstStep, setFirstStep] = useState(ledgerAccounts.length === 0);
  const [isSelectMigrationMode, setIsSelectMigrationMode] = useState<boolean>(false);
  const [chainSubmit, setChainSubmit] = useState(supportedLedger[0].slug);
  const [page, setPage] = useState(0);
  const [selectedAccounts, setSelectedAccounts] = useState<ImportLedgerItem[]>([]);
  const loadingFlag = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMigrateChainSelectModalActive = useMemo(() => checkActive(MigrateChainSelectModalId), [checkActive]);
  const networks = useMemo((): ChainItemType[] => (isSelectMigrationMode ? migrationSupportedLedger : supportedLedger).map((network) => ({
    name: !(network as LedgerNetwork).isGeneric ? network.networkName.replace(' network', '') : network.networkName,
    slug: network.slug
  })), [isSelectMigrationMode, migrationSupportedLedger, supportedLedger]);

  const selectedChain = useMemo((): LedgerNetwork | undefined => {
    const slugKeys = chainSubmit.split(':');

    return supportedLedger.find((n) => n.slug === (slugKeys.length === 2 ? slugKeys[1] : slugKeys[0]));
  }, [chainSubmit, supportedLedger]);

  const accountName = useMemo(() => selectedChain?.accountName || 'Unknown', [selectedChain]);
  const isSelectedMigrateChainMode = useMemo(() => chain === SUBSTRATE_MIGRATION_KEY, [chain]);

  const { error, getAllAddress, isLoading, isLocked, ledger, refresh, warning } = useLedger(chainSubmit, true, false, isSelectedMigrateChainMode);

  const onPreviousStep = useCallback(() => {
    setFirstStep(true);
    setSelectedAccounts([]);
  }, []);

  const onChainChange: BasicOnChangeFunction = useCallback((event) => {
    const value = event.target.value;

    if (value === SUBSTRATE_MIGRATION_KEY) {
      setIsSelectMigrationMode(true);
      activeModal(MigrateChainSelectModalId);
      setChainSubmit(`${SUBSTRATE_MIGRATION_KEY}:${migrateChain}`);
    } else {
      setChainSubmit(value);
    }

    setChain(value);
  }, [activeModal, migrateChain]);

  const onMigrateChainChange: BasicOnChangeFunction = useCallback((event) => {
    const value = event.target.value;

    setMigrateChain(value);
    setChain(SUBSTRATE_MIGRATION_KEY);
    setIsSelectMigrationMode(false);
    setChainSubmit(`${SUBSTRATE_MIGRATION_KEY}:${value}`);
  }, []);

  const onLoadMore = useCallback(async () => {
    if (loadingFlag.current) {
      return;
    }

    loadingFlag.current = true;

    setPage((prev) => prev + 1);

    const start = page * LIMIT_PER_PAGE;
    const end = (page + 1) * LIMIT_PER_PAGE;

    const rs: Array<ImportLedgerItem | null> = new Array<ImportLedgerItem | null>(LIMIT_PER_PAGE).fill(null);

    const maxRetry = 6;

    for (let j = 0; j < maxRetry; j++) {
      try {
        (await getAllAddress(start, end)).forEach(({ address }, index) => {
          rs[start + index] = {
            accountIndex: start + index,
            name: `Ledger ${accountName} ${start + index + 1}`,
            address: address
          };
        });

        break;
      } catch (e) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.error(e);

        if (j === maxRetry - 1) {
          refresh();
          setPage(page - 1);
          setFirstStep(true);
        }
      }
    }

    setLedgerAccounts((prevState) => {
      const result = [...prevState];

      for (let i = start; i < end; i++) {
        result[i] = rs[i];
      }

      return result.filter((rs) => rs);
    });

    loadingFlag.current = false;
  }, [page, getAllAddress, accountName, refresh]);

  const onNextStep = useCallback(() => {
    setFirstStep(false);

    if (!page) {
      onLoadMore().catch(console.error);
    }
  }, [onLoadMore, page]);

  const onClickItem = useCallback((selectedAccounts: ImportLedgerItem[], item: ImportLedgerItem): () => void => {
    return () => {
      const exists = selectedAccounts.find((it) => it.address === item.address);
      let result: ImportLedgerItem[];

      if (exists) {
        result = selectedAccounts.filter((it) => it.address !== item.address);
      } else {
        result = [...selectedAccounts];
        result.push(item);
      }

      setSelectedAccounts(result);
    };
  }, []);

  const renderItem = useCallback((selectedAccounts: ImportLedgerItem[]): ((item: ImportLedgerItem | null, key: string) => React.ReactNode) => {
    // eslint-disable-next-line react/display-name
    return (item: ImportLedgerItem | null, key: string) => {
      if (!item) {
        return (
          <AccountWithNameSkeleton
            direction='vertical'
            key={key}
          />
        );
      }

      const selected = !!selectedAccounts.find((it) => it.address === item.address);
      const originAddress = reformatAddress(item.address, 42);

      const disabled = !!accounts.find((acc) => acc.address === originAddress && acc.genesisHash === selectedChain?.genesisHash);

      return (
        <AccountItemWithName
          accountName={item.name}
          address={item.address}
          className={CN({ disabled: disabled })}
          direction='vertical'
          genesisHash={selectedChain?.genesisHash}
          isSelected={selected || disabled}
          key={key}
          onClick={disabled ? undefined : onClickItem(selectedAccounts, item)}
          showUnselectIcon={true}
        />
      );
    };
  }, [accounts, onClickItem, selectedChain?.genesisHash]);

  const onSubmit = useCallback(() => {
    if (!selectedAccounts.length || !selectedChain) {
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      createAccountHardwareMultiple({
        accounts: selectedAccounts.map((item) => ({
          accountIndex: item.accountIndex,
          address: item.address,
          addressOffset: 0, // don't change
          genesisHash: selectedChain.genesisHash,
          hardwareType: 'ledger',
          name: item.name,
          slip44: selectedChain.slip44,
          isEthereum: selectedChain.isEthereum,
          isGeneric: selectedChain.isGeneric || isSelectedMigrateChainMode
        }))
      })
        .then(() => {
          onComplete();
        })
        .catch((e: Error) => {
          console.log(e);
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    }, 300);
  }, [selectedAccounts, selectedChain, isSelectedMigrateChainMode, onComplete]);

  useEffect(() => {
    setSelectedAccounts([]);
    setLedgerAccounts([]);
    setPage(0);
  }, [chainSubmit]);

  useEffect(() => {
    if (!isMigrateChainSelectModalActive) {
      setIsSelectMigrationMode(false);
    }
  }, [isMigrateChainSelectModalActive]);

  const isConnected = !isLocked && !isLoading && !!ledger;

  return (
    <PageWrapper className={CN(className)}>
      <Layout.WithSubHeaderOnly
        onBack={firstStep ? onBack : onPreviousStep}
        rightFooterButton={{
          children: t('Connect Ledger device'),
          icon: FooterIcon,
          disabled: !isConnected || (!firstStep && !(selectedAccounts.length > 0)),
          onClick: firstStep ? onNextStep : onSubmit,
          loading: isSubmitting
        }}
        subHeaderIcons={[
          {
            icon: <CloseIcon />,
            onClick: goHome
          }
        ]}
        title={t('Connect Ledger device')}
      >
        <div className={CN('container')}>
          <div className='sub-title'>
            {t('Connect and unlock your Ledger, then open the selected network on your Ledger')}
          </div>
          {
            firstStep && (
              <>
                <div className='logo'>
                  <DualLogo
                    leftLogo={(
                      <Image
                        height={56}
                        shape='squircle'
                        src={DefaultLogosMap.subwallet}
                        width={56}
                      />
                    )}
                    rightLogo={(
                      <Image
                        height={56}
                        shape='squircle'
                        src={DefaultLogosMap.ledger}
                        width={56}
                      />
                    )}
                  />
                </div>
                <ChainSelector
                  items={networks}
                  label={t('Select network')}
                  onChange={onChainChange}
                  placeholder={t('Select network')}
                  value={chain}
                />

                {isSelectMigrationMode && <ChainSelector
                  id={MigrateChainSelectModalId}
                  items={networks}
                  label={t('Select network')}
                  onChange={onMigrateChainChange}
                  placeholder={t('Select network')}
                  value={migrateChain}
                />}

                <Button
                  block={true}
                  className={CN('ledger-button', { connected: isConnected, loading: isLoading })}
                  contentAlign='left'
                  icon={(
                    <BackgroundIcon
                      backgroundColor='var(--icon-bg-color)'
                      phosphorIcon={isConnected ? Swatches : CircleNotch}
                      size='sm'
                      weight='fill'
                    />
                  )}
                  onClick={refresh}
                  schema='secondary'
                >
                  <div className='ledger-button-content'>
                    <span className='ledger-info-text'>
                      {isConnected
                        ? t('Device found')
                        : warning || error || (
                          ledger
                            ? t('Loading')
                            : t('Searching Ledger device')
                        )
                      }
                    </span>
                    {
                      isConnected && (
                        <Icon
                          className='check-icon'
                          phosphorIcon={CheckCircle}
                          size='md'
                          weight='fill'
                        />
                      )
                    }
                  </div>
                </Button>
              </>
            )
          }
          {
            !firstStep && (
              <SwList.Section
                className='list-container'
                displayRow={true}
                hasMoreItems={true}
                list={ledgerAccounts.length ? ledgerAccounts : [null, null, null, null, null, null]}
                loadMoreItems={onLoadMore}
                renderItem={renderItem(selectedAccounts)}
                renderOnScroll={false}
                rowGap='var(--list-gap)'
              />
            )
          }
        </div>
      </Layout.WithSubHeaderOnly>
    </PageWrapper>
  );
};

const ConnectLedger = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return {
    '--list-gap': `${token.sizeXS}px`,

    '.ant-sw-screen-layout-body': {
      overflow: 'hidden'
    },

    '.container': {
      padding: `${token.padding}px ${token.padding}px 0`,
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    },

    '.sub-title': {
      padding: `0 ${token.padding}px`,
      fontSize: token.fontSizeHeading6,
      lineHeight: token.lineHeightHeading6,
      color: token.colorTextDescription,
      textAlign: 'center'
    },

    '.logo': {
      margin: `${token.controlHeightLG}px 0`,
      '--logo-size': token.controlHeightLG + token.controlHeightXS,

      '.dual-logo-container': {
        marginBottom: 0,
        padding: 0
      }
    },

    '.ledger-button-content': {
      marginLeft: token.marginSM,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flex: 1,
      overflow: 'hidden'
    },

    '.ledger-info-text': {
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },

    '.ledger-button': {
      marginTop: token.margin - 2,
      padding: `0 ${token.paddingSM}px`,
      '--icon-bg-color': token['gray-4'],

      '&.connected': {
        '--icon-bg-color': token['green-6']
      }
    },

    '.check-icon': {
      color: token.colorSuccess
    },

    '.list-container': {
      margin: `${token.margin}px -${token.margin}px 0`,
      flex: 1
    },

    '.ant-sw-list': {
      '.ant-web3-block': {
        display: 'flex',
        overflow: 'visible',

        '&.disabled': {
          opacity: 0.4,
          cursor: 'not-allowed'
        }
      },

      '.ant-account-item': {
        paddingTop: token.paddingSM,
        paddingBottom: token.paddingSM
      }
    },

    '.ant-sw-list.-display-row': {
      paddingBottom: token.padding
    },

    '.loading': {
      '.anticon': {
        animation: 'spinner-loading 1s infinite linear'
      }
    }
  };
});

export default ConnectLedger;
