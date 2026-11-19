import { IntegrationEvent } from './integration-event';
import type { IntegrationEventProps } from './integration-event.types';
import type { WagerTransactionRejectedData } from './event-data.types';

export class WagerTransactionRejectedEvent extends IntegrationEvent<WagerTransactionRejectedData> {
  readonly eventType = 'WagerTransactionRejected';
  readonly version = 1;

  constructor(
    props: IntegrationEventProps<WagerTransactionRejectedData>,
  ) {
    super(props);
  }
}
