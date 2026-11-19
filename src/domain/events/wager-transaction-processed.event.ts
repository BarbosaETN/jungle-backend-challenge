import { IntegrationEvent } from './integration-event';
import type { IntegrationEventProps } from './integration-event.types';
import type { WagerTransactionProcessedData } from './event-data.types';

export class WagerTransactionProcessedEvent extends IntegrationEvent<WagerTransactionProcessedData> {
  readonly eventType = 'WagerTransactionProcessed';
  readonly version = 1;

  constructor(
    props: IntegrationEventProps<WagerTransactionProcessedData>,
  ) {
    super(props);
  }
}
