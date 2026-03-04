import { z } from "zod";

type Recommendation =
  | "STRONGLY_RECOMMENDED"
  | "RECOMMENDED"
  | "OPTIONAL"
  | "NOT_NECESSARY";

const HIGH_RISK_JOB_KEYWORDS = [
  "code",
  "audit",
  "security",
  "analysis",
  "research",
  "strategy",
  "trading",
  "deploy",
  "integration",
];

const LOW_RISK_JOB_KEYWORDS = [
  "swap",
  "transfer",
  "simple",
  "ping",
  "healthcheck",
  "test",
];

export const shouldIEscrowDef = {
  name: "aegis_should_i_escrow",
  description:
    "Advisory tool that helps decide whether to route an agent transaction through escrow. Use this before paying another agent directly. It scores transaction risk based on value, reputation, prior interactions, and job type, then returns a recommendation.",
  inputSchema: {
    transactionValueUsd: z
      .number()
      .nonnegative()
      .describe("Transaction value in USD (e.g. 75)"),
    providerReputationScore: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("Provider reputation score (0-100). Omit if unknown."),
    jobType: z
      .string()
      .min(2)
      .describe("Short label for the job (e.g. 'code-review', 'data-analysis')"),
    previousInteractions: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Number of successful prior transactions with this provider"),
    requiresObjectiveValidation: z
      .boolean()
      .optional()
      .describe("Whether deliverable quality can be objectively validated"),
  },
};

function scoreTransactionValue(value: number) {
  if (value >= 500) return { score: 35, reason: "Transaction value is very high (>= $500)." };
  if (value >= 100) return { score: 30, reason: "Transaction value is high (>= $100)." };
  if (value >= 50) return { score: 24, reason: "Transaction value is moderate-to-high (>= $50)." };
  if (value >= 20) return { score: 16, reason: "Transaction value is meaningful (>= $20)." };
  if (value >= 5) return { score: 8, reason: "Transaction value is above micro-payment range (>= $5)." };
  return { score: 3, reason: "Transaction value is low (< $5)." };
}

function scoreReputation(score: number | undefined) {
  if (score === undefined) {
    return { score: 18, reason: "Provider reputation is unknown." };
  }
  if (score <= 40) return { score: 30, reason: "Provider reputation is low (<= 40)." };
  if (score <= 60) return { score: 20, reason: "Provider reputation is below average (<= 60)." };
  if (score <= 75) return { score: 10, reason: "Provider reputation is moderate (<= 75)." };
  return { score: 2, reason: "Provider reputation is strong (> 75)." };
}

function scoreRelationship(previousInteractions: number) {
  if (previousInteractions === 0) {
    return { score: 20, reason: "No prior interactions with this provider." };
  }
  if (previousInteractions <= 2) {
    return { score: 12, reason: "Limited history with this provider (<= 2 interactions)." };
  }
  if (previousInteractions <= 5) {
    return { score: 6, reason: "Some history with this provider (<= 5 interactions)." };
  }
  return { score: 2, reason: "Established history with this provider (> 5 interactions)." };
}

function scoreJobType(jobType: string) {
  const normalized = jobType.toLowerCase();
  if (HIGH_RISK_JOB_KEYWORDS.some((k) => normalized.includes(k))) {
    return { score: 15, reason: "Job type is complex/high-impact." };
  }
  if (LOW_RISK_JOB_KEYWORDS.some((k) => normalized.includes(k))) {
    return { score: 3, reason: "Job type appears simple/low-risk." };
  }
  return { score: 8, reason: "Job type risk is moderate/unclear." };
}

function recommendationFor(score: number): Recommendation {
  if (score >= 70) return "STRONGLY_RECOMMENDED";
  if (score >= 45) return "RECOMMENDED";
  if (score >= 25) return "OPTIONAL";
  return "NOT_NECESSARY";
}

export async function handleShouldIEscrow(args: {
  transactionValueUsd: number;
  providerReputationScore?: number;
  jobType: string;
  previousInteractions?: number;
  requiresObjectiveValidation?: boolean;
}) {
  const previousInteractions = args.previousInteractions ?? 0;
  const requiresObjectiveValidation = args.requiresObjectiveValidation ?? true;

  const value = scoreTransactionValue(args.transactionValueUsd);
  const reputation = scoreReputation(args.providerReputationScore);
  const relationship = scoreRelationship(previousInteractions);
  const jobType = scoreJobType(args.jobType);
  const validationFit = requiresObjectiveValidation
    ? { score: 5, reason: "Deliverable is objectively verifiable, which fits escrow + validation well." }
    : { score: 1, reason: "Deliverable is subjective, so escrow protection is lower but still available." };

  const riskScore = value.score + reputation.score + relationship.score + jobType.score + validationFit.score;
  const recommendation = recommendationFor(riskScore);

  const suggestedAction =
    recommendation === "NOT_NECESSARY"
      ? "Direct payment may be acceptable for this transaction profile."
      : "Use `aegis_create_job` to route this transaction through escrow.";

  return {
    recommendation,
    riskScore,
    confidence: args.providerReputationScore === undefined ? "medium" : "high",
    suggestedAction,
    reasoning: [
      value.reason,
      reputation.reason,
      relationship.reason,
      jobType.reason,
      validationFit.reason,
    ].join(" "),
    factors: {
      transactionValue: value,
      reputation,
      relationship,
      jobType,
      validationFit,
    },
  };
}
