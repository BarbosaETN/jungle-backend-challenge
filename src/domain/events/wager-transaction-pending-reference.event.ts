import { IntegrationEvent } from './integration-event';
import type { IntegrationEventProps } from './integration-event.types';
import type { WagerTransactionPendingReferenceData } from './event-data.types';

export class WagerTransactionPendingReferenceEvent extends IntegrationEvent<WagerTransactionPendingReferenceData> {
  readonly eventType = 'WagerTransactionPendingReference';
  readonly version = 1;

  constructor(
    props: IntegrationEventProps<WagerTransactionPendingReferenceData>,
  ) {
    super(props);
  }
}
