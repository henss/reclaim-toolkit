import { z } from "zod";
import type {
  ReclaimTaskAssignmentTimeScheme,
  ReclaimTaskEventCategory
} from "./types.js";

export const ReclaimTimeSchemeWindowSnapshotSchema = z.object({
  dayOfWeek: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional()
});

export const ReclaimTimeSchemeSnapshotSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  taskCategory: z.string().default("PERSONAL"),
  description: z.string().optional(),
  timezone: z.string().optional(),
  features: z.array(z.string()).default([]),
  windows: z.array(ReclaimTimeSchemeWindowSnapshotSchema).default([])
});

export interface TimePolicyDiscoveryItem {
  id: string;
  title: string;
  taskCategory: string;
  description?: string;
  features: string[];
  matchesDefaultEventCategory: boolean;
}

export interface TimePolicySelectionPreview {
  selectedPolicy?: TimePolicyDiscoveryItem;
  selectionReason: string;
  policies: TimePolicyDiscoveryItem[];
}

function normalizePolicyTitle(value: string): string {
  return value.trim().toLowerCase();
}

function findPolicyByTitle(
  schemes: ReclaimTaskAssignmentTimeScheme[],
  preferredTitle: string
): ReclaimTaskAssignmentTimeScheme | undefined {
  const normalizedTitle = normalizePolicyTitle(preferredTitle);
  const exact = schemes.find((scheme) => normalizePolicyTitle(scheme.title) === normalizedTitle);
  if (exact) {
    return exact;
  }

  const partialMatches = schemes.filter((scheme) => normalizePolicyTitle(scheme.title).includes(normalizedTitle));
  return partialMatches.length === 1 ? partialMatches[0] : undefined;
}

export function toDiscoveryItem(
  scheme: ReclaimTaskAssignmentTimeScheme,
  eventCategory: ReclaimTaskEventCategory
): TimePolicyDiscoveryItem {
  return {
    id: scheme.id,
    title: scheme.title,
    taskCategory: scheme.taskCategory,
    ...(scheme.description ? { description: scheme.description } : {}),
    features: scheme.features,
    matchesDefaultEventCategory: scheme.taskCategory === eventCategory
  };
}

export function previewTimePolicySelection(
  schemes: ReclaimTaskAssignmentTimeScheme[],
  options: {
    preferredTimePolicyId?: string;
    preferredTimePolicyTitle?: string;
    eventCategory: ReclaimTaskEventCategory;
  }
): TimePolicySelectionPreview {
  const policies = schemes.map((scheme) => toDiscoveryItem(scheme, options.eventCategory));

  if (policies.length === 0) {
    return {
      selectionReason: "No Reclaim task-assignment time policies were returned.",
      policies
    };
  }

  if (options.preferredTimePolicyId) {
    const selectedPolicy = policies.find((scheme) => scheme.id === options.preferredTimePolicyId);
    return {
      selectedPolicy,
      selectionReason: selectedPolicy
        ? `Matched preferred Reclaim time policy id ${options.preferredTimePolicyId}.`
        : `Preferred Reclaim time policy id ${options.preferredTimePolicyId} was not found.`,
      policies
    };
  }

  if (options.preferredTimePolicyTitle) {
    const selectedScheme = findPolicyByTitle(schemes, options.preferredTimePolicyTitle);
    const selectedPolicy = selectedScheme ? policies.find((scheme) => scheme.id === selectedScheme.id) : undefined;
    return {
      selectedPolicy,
      selectionReason: selectedPolicy
        ? `Matched preferred Reclaim time policy title "${options.preferredTimePolicyTitle}".`
        : `Preferred Reclaim time policy title "${options.preferredTimePolicyTitle}" was not found as an exact or unique partial match.`,
      policies
    };
  }

  const selectedPolicy =
    policies.find((scheme) => scheme.matchesDefaultEventCategory) ?? policies[0];
  return {
    selectedPolicy,
    selectionReason: selectedPolicy.matchesDefaultEventCategory
      ? `Selected the first Reclaim time policy matching event category ${options.eventCategory}.`
      : "Selected the first returned Reclaim time policy because none matched the default event category.",
    policies
  };
}

export function selectTimeScheme(
  schemes: ReclaimTaskAssignmentTimeScheme[],
  options: {
    preferredTimePolicyId?: string;
    preferredTimePolicyTitle?: string;
    eventCategory: ReclaimTaskEventCategory;
  }
): ReclaimTaskAssignmentTimeScheme {
  if (schemes.length === 0) {
    throw new Error("No Reclaim task-assignment time policies were returned.");
  }

  if (options.preferredTimePolicyId) {
    const exact = schemes.find((scheme) => scheme.id === options.preferredTimePolicyId);
    if (!exact) {
      throw new Error(`Preferred Reclaim time policy id ${options.preferredTimePolicyId} was not found.`);
    }
    return exact;
  }

  if (options.preferredTimePolicyTitle) {
    const match = findPolicyByTitle(schemes, options.preferredTimePolicyTitle);
    if (!match) {
      throw new Error(
        `Preferred Reclaim time policy title "${options.preferredTimePolicyTitle}" was not found as an exact or unique partial match.`
      );
    }
    return match;
  }

  const preview = previewTimePolicySelection(schemes, options);
  return schemes.find((scheme) => scheme.id === preview.selectedPolicy?.id) ?? schemes[0]!;
}
