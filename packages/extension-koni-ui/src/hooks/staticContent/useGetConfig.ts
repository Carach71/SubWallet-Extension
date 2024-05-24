// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_SESSION_VALUE, LATEST_SESSION, STATIC_DATA_CONTENT_URL } from '@subwallet/extension-koni-ui/constants';
import { SessionStorage } from '@subwallet/extension-koni-ui/types';
import axios from 'axios';
import { useCallback, useMemo } from 'react';

interface BackupTimeOutData {
  backupTimeout: number
}

const useGetConfig = () => {
  const latestSession = useMemo(() =>
    (JSON.parse(localStorage.getItem(LATEST_SESSION) || JSON.stringify(DEFAULT_SESSION_VALUE))) as SessionStorage, []);

  const getConfig = useCallback(async () => {
    try {
      const res = await axios
        .get(`${STATIC_DATA_CONTENT_URL}/config/remind-backup/preview.json`);

      return (res?.data as BackupTimeOutData).backupTimeout;
    } catch {
      return latestSession.timeBackup;
    }
  }, [latestSession.timeBackup]);

  return { getConfig };
};

export default useGetConfig;