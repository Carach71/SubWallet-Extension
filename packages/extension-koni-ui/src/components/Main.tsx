// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import styled from 'styled-components';

import { Theme } from '../types';

interface Props {
  children: React.ReactNode;
  className?: string;
}

function Main ({ children, className }: Props): React.ReactElement<Props> {
  return (
    <main className={className}>
      {children}
    </main>
  );
}

export default styled(Main)<Props>(({ theme }) => {
  const { token } = theme as Theme;

  return ({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',

    '*': {
      fontFamily: token.fontFamily
    }
  });
});
