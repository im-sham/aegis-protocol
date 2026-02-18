import { GraphQLClient } from "graphql-request";

let client: GraphQLClient | null = null;

export function getSubgraphClient(url: string): GraphQLClient {
  if (!client) {
    client = new GraphQLClient(url);
  }
  return client;
}

export const JOB_FIELDS = `
  id
  clientAgentId
  providerAgentId
  clientAddress
  providerWallet
  amount
  protocolFeeBps
  validationScore
  validationThreshold
  jobSpecHash
  jobSpecURI
  deliverableHash
  deliverableURI
  state
  deadline
  createdAt
  deliveredAt
  settledAt
  disputeWindowEnd
  providerAmount
  protocolFee
  refundAmount
  createdAtBlock
  createdAtTx
`;

export const DISPUTE_FIELDS = `
  id
  jobId
  initiator
  respondent
  arbitrator
  clientPercent
  method
  resolved
  createdAt
  resolvedAt
  createdAtBlock
  createdAtTx
`;

export const TEMPLATE_FIELDS = `
  id
  templateId
  name
  creator
  defaultValidator
  defaultTimeout
  minValidation
  active
  createdAt
  jobCount
`;
