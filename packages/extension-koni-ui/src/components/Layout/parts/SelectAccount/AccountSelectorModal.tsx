// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ButtonProps } from '@subwallet/react-ui/es/button/button';

import { CurrentAccountInfo } from '@subwallet/extension-base/background/types';
import { AccountProxy, AccountProxyType } from '@subwallet/extension-base/types';
import { AccountProxySelectorAllItem, AccountProxySelectorItem, GeneralEmptyList } from '@subwallet/extension-koni-ui/components';
import SelectAccountFooter from '@subwallet/extension-koni-ui/components/Layout/parts/SelectAccount/Footer';
import Search from '@subwallet/extension-koni-ui/components/Search';
import { SELECT_ACCOUNT_MODAL } from '@subwallet/extension-koni-ui/constants/modal';
import { useDefaultNavigate, useSetSessionLatest } from '@subwallet/extension-koni-ui/hooks';
import useTranslation from '@subwallet/extension-koni-ui/hooks/common/useTranslation';
import { saveCurrentAccountAddress } from '@subwallet/extension-koni-ui/messaging';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { Theme } from '@subwallet/extension-koni-ui/themes';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import { isAccountAll } from '@subwallet/extension-koni-ui/utils';
import { Icon, ModalContext, SwList, SwModal, Tooltip } from '@subwallet/react-ui';
import CN from 'classnames';
import { Circle, Export } from 'phosphor-react';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import styled, { useTheme } from 'styled-components';

type ListItemGroupLabel = {
  id: string;
  groupLabel: string;
}

type ListItem = AccountProxy | ListItemGroupLabel;

type Props = ThemeProps

const renderEmpty = () => <GeneralEmptyList />;

const modalId = SELECT_ACCOUNT_MODAL;

const Component: React.FC<Props> = ({ className }: Props) => {
  const location = useLocation();
  const { t } = useTranslation();
  const { inactiveModal } = useContext(ModalContext);
  const [searchValue, setSearchValue] = useState<string>('');
  const { token } = useTheme() as Theme;
  const { goHome } = useDefaultNavigate();
  const navigate = useNavigate();
  const { setStateSelectAccount } = useSetSessionLatest();

  const accountProxies = useSelector((state: RootState) => state.accountState.accountProxies);
  const currentAccountProxy = useSelector((state: RootState) => state.accountState.currentAccountProxy);

  const listItems = useMemo<ListItem[]>(() => {
    let accountAll: AccountProxy | undefined;
    const result: ListItem[] = [];
    const masterAccounts: ListItem[] = [];
    const qrSignerAccounts: ListItem[] = [];
    const watchOnlyAccounts: ListItem[] = [];
    const ledgerAccounts: ListItem[] = [];
    const injectedAccounts: ListItem[] = [];
    const unknownAccounts: ListItem[] = [];

    accountProxies.forEach((ap) => {
      if (searchValue) {
        if (!ap.name.toLowerCase().includes(searchValue.toLowerCase())) {
          return;
        }
      } else if (isAccountAll(ap.id) || ap.accountType === AccountProxyType.ALL_ACCOUNT) {
        accountAll = ap;

        return;
      }

      if (ap.accountType === AccountProxyType.SOLO || ap.accountType === AccountProxyType.UNIFIED) {
        masterAccounts.push(ap);
      } else if (ap.accountType === AccountProxyType.QR) {
        qrSignerAccounts.push(ap);
      } else if (ap.accountType === AccountProxyType.READ_ONLY) {
        watchOnlyAccounts.push(ap);
      } else if (ap.accountType === AccountProxyType.LEDGER) {
        ledgerAccounts.push(ap);
      } else if (ap.accountType === AccountProxyType.INJECTED) {
        injectedAccounts.push(ap);
      } else if (ap.accountType === AccountProxyType.UNKNOWN) {
        unknownAccounts.push(ap);
      }
    });

    if (masterAccounts.length) {
      result.push(...masterAccounts);
    }

    if (qrSignerAccounts.length) {
      qrSignerAccounts.unshift({
        id: 'qr',
        groupLabel: t('QR signer account')
      });

      result.push(...qrSignerAccounts);
    }

    if (watchOnlyAccounts.length) {
      watchOnlyAccounts.unshift({
        id: 'watch-only',
        groupLabel: t('Watch-only account')
      });

      result.push(...watchOnlyAccounts);
    }

    if (ledgerAccounts.length) {
      ledgerAccounts.unshift({
        id: 'ledger',
        groupLabel: t('Ledger account')
      });

      result.push(...ledgerAccounts);
    }

    if (injectedAccounts.length) {
      injectedAccounts.unshift({
        id: 'injected',
        groupLabel: t('Injected account')
      });

      result.push(...ledgerAccounts);
    }

    if (unknownAccounts.length) {
      unknownAccounts.unshift({
        id: 'unknown',
        groupLabel: t('Unknown account')
      });

      result.push(...unknownAccounts);
    }

    if (result.length && accountAll) {
      result.unshift(accountAll);
    }

    return result;
  }, [accountProxies, searchValue, t]);

  const hasSearchValue = !!searchValue;

  const showAllAccount = useMemo(() => {
    return !hasSearchValue && accountProxies.filter(({ id }) => !isAccountAll(id)).length > 1;
  }, [hasSearchValue, accountProxies]);

  const onSelect = useCallback((accountProxy: AccountProxy) => {
    return () => {
      const targetAccountProxy = accountProxies.find((ap) => ap.id === accountProxy.id);

      if (targetAccountProxy) {
        const accountInfo = {
          address: targetAccountProxy.id
        } as CurrentAccountInfo;

        saveCurrentAccountAddress(accountInfo).then(() => {
          const pathName = location.pathname;
          const locationPaths = location.pathname.split('/');

          if (locationPaths) {
            if (locationPaths[1] === 'home') {
              if (locationPaths.length >= 3) {
                if (pathName.startsWith('/home/nfts')) {
                  navigate('/home/nfts/collections');
                } else if (pathName.startsWith('/home/tokens/detail')) {
                  navigate('/home/tokens');
                } else {
                  navigate(`/home/${locationPaths[2]}`);
                }
              }
            } else {
              goHome();
            }
          }
        }).catch((e) => {
          console.error('Failed to switch account', e);
        });
      } else {
        console.error('Failed to switch account');
      }

      inactiveModal(modalId);
    };
  }, [accountProxies, inactiveModal, location.pathname, navigate, goHome]);

  const onViewAccountDetail = useCallback((accountProxy: AccountProxy) => {
    return () => {
      inactiveModal(modalId);
      setTimeout(() => {
        navigate(`/accounts/detail/${accountProxy.id}`);
      }, 100);
    };
  }, [inactiveModal, navigate]);

  const renderItem = useCallback((item: ListItem): React.ReactNode => {
    if ((item as ListItemGroupLabel).groupLabel) {
      return (
        <div
          className={'list-item-group-label'}
          key={item.id}
        >
          {(item as ListItemGroupLabel).groupLabel}
        </div>
      );
    }

    const currentAccountIsAll = isAccountAll(item.id);

    if (currentAccountIsAll) {
      if (showAllAccount) {
        return (
          <AccountProxySelectorAllItem
            className='all-account-selection'
            isSelected={item.id === currentAccountProxy?.id}
            key={item.id}
            onClick={onSelect(item as AccountProxy)}
          />
        );
      } else {
        return null;
      }
    }

    return (
      <AccountProxySelectorItem
        accountProxy={item as AccountProxy}
        className='account-selection'
        isSelected={item.id === currentAccountProxy?.id}
        key={item.id}
        onClick={onSelect(item as AccountProxy)}
        onClickMoreButton={onViewAccountDetail(item as AccountProxy)}
      />
    );
  }, [currentAccountProxy?.id, onSelect, onViewAccountDetail, showAllAccount]);

  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const _onCancel = useCallback(() => {
    inactiveModal(modalId);
    setSearchValue('');
    setStateSelectAccount(true);
  }, [inactiveModal, setStateSelectAccount]);

  const rightIconProps = useMemo((): ButtonProps => {
    return ({
      icon: (
        <Icon
          className={CN('__export-remind-btn')}
          phosphorIcon={Export}
          weight='fill'
        />
      ),
      children: (
        <Tooltip
          className={'__icon-export-remind'}
          open={true}
          overlayClassName={CN('__tooltip-overlay-remind')}
          placement={'bottomLeft'}
          title={t('Export and back up accounts')}
        >
          <div>
            <Icon
              customSize={'7.39px'}
              iconColor={token.colorHighlight}
              phosphorIcon={Circle}
              weight={'fill'}
            />
          </div>
        </Tooltip>
      ),
      size: 'xs',
      type: 'ghost',
      tooltipPlacement: 'topLeft'
    });
  }, [t, token.colorHighlight]);

  return (
    <SwModal
      className={CN(className)}
      footer={<SelectAccountFooter />}
      id={modalId}
      onCancel={_onCancel}
      rightIconProps={rightIconProps}
      title={t('Select account')}
    >
      <Search
        className={'__search-box'}
        onSearch={handleSearch}
        placeholder={t<string>('Account name')}
        searchValue={searchValue}
      />
      <SwList
        className={'__list-container'}
        list={listItems}
        renderItem={renderItem}
        renderWhenEmpty={renderEmpty}
      />
    </SwModal>
  );
};

export const AccountSelectorModal = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return {
    '.ant-sw-modal-content': {
      height: '100vh'
    },

    '.ant-sw-modal-body': {
      overflow: 'auto',
      display: 'flex',
      flex: 1,
      flexDirection: 'column'
    },

    '.list-item-group-label': {
      textTransform: 'uppercase',
      fontSize: 11,
      lineHeight: '18px',
      fontWeight: token.headingFontWeight,
      color: token.colorTextLight3
    },

    '.__search-box': {
      marginBottom: token.marginXS
    },

    '.__list-container': {
      flex: 1,
      overflow: 'auto',

      '> div + div': {
        marginTop: token.marginXS
      }
    }
  };
});