import { IntegrationEvent } from './integration-event';
import type { IntegrationEventProps } from './integration-event.types';
import type { WalletBalanceChangedData } from './event-data.types';

export class WalletBalanceChangedEvent extends IntegrationEvent<WalletBalanceChangedData> {
  readonly eventType = 'WalletBalanceChanged';
  readonly version = 1;

  constructor(
    props: IntegrationEventProps<WalletBalanceChangedData>,
  ) {
    super(props);
  }
}
