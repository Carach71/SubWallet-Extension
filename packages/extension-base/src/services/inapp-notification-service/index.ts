// Copyright 2019-2022 @subwallet/extension-base authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ExtrinsicType } from '@subwallet/extension-base/background/KoniTypes';
import { CRON_FETCH_NOTIFICATION_INTERVAL, CRON_LISTEN_NOTIFICATION_INTERVAL } from '@subwallet/extension-base/constants';
import { CronServiceInterface, ServiceStatus } from '@subwallet/extension-base/services/base/types';
import { NotificationTitleMap } from '@subwallet/extension-base/services/inapp-notification-service/consts';
import { NotificationActionType, NotificationInfo } from '@subwallet/extension-base/services/inapp-notification-service/interfaces';
import DatabaseService from '@subwallet/extension-base/services/storage-service/DatabaseService';
import { UnstakingStatus, YieldPoolType } from '@subwallet/extension-base/types';
import { GetNotificationCountResult, GetNotificationParams } from '@subwallet/extension-base/types/notification';
import { BehaviorSubject } from 'rxjs';

export class InappNotificationService implements CronServiceInterface {
  status: ServiceStatus;
  private refreshGetNotificationTimeout: NodeJS.Timeout | undefined;
  private refreshListenNotificationTimeout: NodeJS.Timeout | undefined;
  private readonly dbService: DatabaseService;
  private unreadNotificationCountSubject = new BehaviorSubject<GetNotificationCountResult>({count: 0});
  private notificationsSubject = new BehaviorSubject<NotificationInfo[]>([]);

  constructor (dbService: DatabaseService) {
    this.status = ServiceStatus.NOT_INITIALIZED;
    this.dbService = dbService;
  }

  async getNotification (id: string) {
    await this.dbService.getNotification(id);
  }

  async updateNotification (notification: NotificationInfo) {
    await this.dbService.updateNotification(notification);
  }

  async markAllRead (address: string) {
    await this.dbService.markAllRead(address);
  }

  async markRead (notification: NotificationInfo) {
    await this.dbService.markRead(notification);
  }

  async markUnread (notification: NotificationInfo) {
    await this.dbService.markUnread(notification);
  }

  async changeReadStatus (notification: NotificationInfo) {
    await this.dbService.changeReadStatus(notification);
  }

  async getWithdrawNotifications () {
    const NOTIFICATION_ACTION_TYPE = NotificationActionType.WITHDRAW;
    const allWithdrawNotifications: NotificationInfo[] = [];
    const poolPositions = await this.dbService.getYieldPositions();

    for (const poolPosition of poolPositions) {
      if (!poolPosition.unstakings.length) {
        continue;
      }

      const STAKING_TYPE = poolPosition.type;
      const symbol = poolPosition.slug.split('___')[0];
      const address = poolPosition.address;
      const timestamp = Date.now();

      for (const unstaking of poolPosition.unstakings) {
        if (unstaking.status === UnstakingStatus.CLAIMABLE) {
          allWithdrawNotifications.push({
            id: `${NOTIFICATION_ACTION_TYPE}___${STAKING_TYPE}___${timestamp}`,
            title: NotificationTitleMap[NOTIFICATION_ACTION_TYPE],
            description: this.getWithdrawNotificationDescription(unstaking.claimable, symbol, STAKING_TYPE), // divide decimal
            address: address,
            time: timestamp,
            extrinsicType: ExtrinsicType.STAKING_WITHDRAW,
            isRead: false,
            actionType: NotificationActionType.WITHDRAW
          });
        }
      }
    }

    return allWithdrawNotifications;
  }

  getWithdrawNotificationDescription (amount: string, symbol: string, stakingType: YieldPoolType) {
    return `You has ${amount} ${symbol} ${stakingType} to withdraw`;
  }

  createLastestNotifications () {
    clearTimeout(this.refreshGetNotificationTimeout);

    this.getWithdrawNotifications()
      .then(async (notifications) => {
        await this.dbService.upsertNotifications(notifications);
      })
      .catch((e) => {
        console.error(e);
      });

    this.refreshGetNotificationTimeout = setTimeout(this.createLastestNotifications.bind(this), CRON_FETCH_NOTIFICATION_INTERVAL);
  }

  listenLastestNotifications () {
    clearTimeout(this.refreshListenNotificationTimeout);

    this.updateUnreadNotificationCountSubject()
      .then().catch((e) => console.error(e));

    this.updateNotificationsSubject()
      .then().catch((e) => console.error(e));

    this.refreshListenNotificationTimeout = setTimeout(this.listenLastestNotifications.bind(this), CRON_LISTEN_NOTIFICATION_INTERVAL);
  }

  private async updateUnreadNotificationCountSubject () {
    const unreadNotificationCount = await this.dbService.getAllUnreadNotifications();

    this.unreadNotificationCountSubject.next({count: unreadNotificationCount});
  }

  public subscribeUnreadNotificationCount (callback: (data: GetNotificationCountResult) => void) {
    return this.unreadNotificationCountSubject.subscribe({
      next: callback
    });
  }

  public getUnreadNotificationCount () {
    return this.unreadNotificationCountSubject.getValue()
  }

  public async updateNotificationsSubject () {
    const notifications = await this.dbService.getAllNotifications();

    this.notificationsSubject.next(notifications);
  }

  public subscribeNotifications (callback: (data: NotificationInfo[]) => void) {
    return this.notificationsSubject.subscribe({
      next: callback
    });
  }

  public getNotifications () {
    return this.notificationsSubject.getValue();
  }

  public async getNotificationsByParams (params: GetNotificationParams) {
    return await this.dbService.getNotificationsByParams(params);
  }

  async start (): Promise<void> {
    if (this.status === ServiceStatus.STARTED) {
      return;
    }

    try {
      this.status = ServiceStatus.STARTING;
      await this.startCron();
      this.status = ServiceStatus.STARTED;
    } catch (e) {

    }
  }

  async startCron (): Promise<void> {
    this.listenLastestNotifications();
    this.createLastestNotifications();

    return Promise.resolve();
  }

  async stop (): Promise<void> {
    try {
      this.status = ServiceStatus.STOPPING;
      await this.stopCron();
      this.status = ServiceStatus.STOPPED;
    } catch (e) {

    }
  }

  stopCron (): Promise<void> {
    clearTimeout(this.refreshGetNotificationTimeout);
    clearTimeout(this.refreshListenNotificationTimeout);

    return Promise.resolve(undefined);
  }
}
