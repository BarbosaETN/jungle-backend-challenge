#!/bin/bash

echo "Creating Jungle SQS queue..."

awslocal sqs create-queue \
  --queue-name jungle-events

echo "Jungle SQS queue created."