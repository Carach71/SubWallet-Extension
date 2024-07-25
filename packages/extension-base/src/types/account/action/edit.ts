// Copyright 2019-2022 @subwallet/extension-base authors & contributors
// SPDX-License-Identifier: Apache-2.0

export interface RequestAccountProxyEdit {
  proxyId: string;
  name: string;
}

export interface RequestAccountProxyForget {
  proxyId: string;
  lockAfter: boolean;
}
