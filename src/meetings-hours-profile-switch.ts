import { z } from "zod";
import { createPreviewReceipt, type PreviewReceipt } from "./preview-receipts.js";
import {
  ReclaimTimeSchemeSnapshotSchema,
  type TimePolicyDiscoveryItem
} from "./time-policy-selection.js";
import {
  explainHoursProfileConflict,
  type TimePolicyConflictHoursProfileExplanation
} from "./time-policy-conflicts.js";

const ReclaimHoursProfileSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  eventCategory: z.enum(["PERSONAL", "WORK"]),
  preferredTimePolicyId: z.string().min(1).optional(),
  preferredTimePolicyTitle: z.string().min(1).optional()
});

export const ReclaimHoursPresetSwitchPreviewInputSchema = z.object({
  currentProfileId: z.string().min(1).optional(),
  profiles: z.array(ReclaimHoursProfileSchema).min(1),
  timeSchemes: z.array(ReclaimTimeSchemeSnapshotSchema).default([])
});

export interface HoursProfilePreview {
  id: string;
  title: string;
  eventCategory: "PERSONAL" | "WORK";
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
  selectedPolicy?: TimePolicyDiscoveryItem;
  selectionReason: string;
  timePolicyExplanation: TimePolicyConflictHoursProfileExplanation;
  isCurrentProfile: boolean;
}

export interface HoursPresetSwitchPreviewTarget {
  targetProfileId: string;
  targetProfileTitle: string;
  outcome: "same_policy" | "different_policy" | "missing_policy";
  currentPolicyId?: string;
  currentPolicyTitle?: string;
  targetPolicyId?: string;
  targetPolicyTitle?: string;
  summary: string;
}

export interface HoursPresetSwitchPreview {
  profileCount: number;
  currentProfileId: string;
  profiles: HoursProfilePreview[];
  switchPreviews: HoursPresetSwitchPreviewTarget[];
  readSafety: "read_only";
  previewReceipt: PreviewReceipt;
}

export function parseReclaimHoursPresetSwitchPreviewInput(
  raw: unknown
): z.infer<typeof ReclaimHoursPresetSwitchPreviewInputSchema> {
  return ReclaimHoursPresetSwitchPreviewInputSchema.parse(raw);
}

function describeSwitchPreview(
  currentProfile: HoursProfilePreview,
  targetProfile: HoursProfilePreview
): HoursPresetSwitchPreviewTarget {
  const currentPolicyId = currentProfile.selectedPolicy?.id;
  const targetPolicyId = targetProfile.selectedPolicy?.id;

  if (!currentPolicyId || !targetPolicyId) {
    return {
      targetProfileId: targetProfile.id,
      targetProfileTitle: targetProfile.title,
      outcome: "missing_policy",
      currentPolicyId,
      currentPolicyTitle: currentProfile.selectedPolicy?.title,
      targetPolicyId,
      targetPolicyTitle: targetProfile.selectedPolicy?.title,
      summary: !targetPolicyId
        ? `Switching to ${targetProfile.title} would leave the hours preset unresolved. ${targetProfile.selectionReason}`
        : `The current profile ${currentProfile.title} does not resolve an hours preset, so compare the selection reasoning before switching.`
    };
  }

  if (currentPolicyId === targetPolicyId) {
    return {
      targetProfileId: targetProfile.id,
      targetProfileTitle: targetProfile.title,
      outcome: "same_policy",
      currentPolicyId,
      currentPolicyTitle: currentProfile.selectedPolicy?.title,
      targetPolicyId,
      targetPolicyTitle: targetProfile.selectedPolicy?.title,
      summary: `Switching to ${targetProfile.title} keeps the same hours preset (${targetProfile.selectedPolicy?.title ?? targetPolicyId}).`
    };
  }

  return {
    targetProfileId: targetProfile.id,
    targetProfileTitle: targetProfile.title,
    outcome: "different_policy",
    currentPolicyId,
    currentPolicyTitle: currentProfile.selectedPolicy?.title,
    targetPolicyId,
    targetPolicyTitle: targetProfile.selectedPolicy?.title,
    summary: `Switching to ${targetProfile.title} changes the hours preset from ${currentProfile.selectedPolicy?.title ?? currentPolicyId} to ${targetProfile.selectedPolicy?.title ?? targetPolicyId}.`
  };
}

export function previewHoursPresetSwitches(
  input: z.infer<typeof ReclaimHoursPresetSwitchPreviewInputSchema>
): HoursPresetSwitchPreview {
  const profiles = input.profiles.map((profile) => {
    const timePolicyExplanation = explainHoursProfileConflict(profile, {
      tasks: [],
      focusBlocks: [],
      buffers: [],
      hoursProfiles: [],
      timeSchemes: input.timeSchemes,
      defaultTaskEventCategory: profile.eventCategory
    });

    return {
      id: profile.id,
      title: profile.title,
      eventCategory: profile.eventCategory,
      preferredTimePolicyId: profile.preferredTimePolicyId,
      preferredTimePolicyTitle: profile.preferredTimePolicyTitle,
      selectedPolicy: timePolicyExplanation.selectedPolicy,
      selectionReason: timePolicyExplanation.selectionReason,
      timePolicyExplanation,
      isCurrentProfile: false
    } satisfies HoursProfilePreview;
  });

  const currentProfileId = input.currentProfileId ?? profiles[0]!.id;
  const currentProfile = profiles.find((profile) => profile.id === currentProfileId);
  if (!currentProfile) {
    throw new Error(`Current profile ${currentProfileId} was not found in the preview input.`);
  }

  const profilePreviews = profiles.map((profile) => ({
    ...profile,
    isCurrentProfile: profile.id === currentProfile.id
  }));

  return {
    profileCount: profilePreviews.length,
    currentProfileId: currentProfile.id,
    profiles: profilePreviews,
    switchPreviews: profilePreviews
      .filter((profile) => profile.id !== currentProfile.id)
      .map((profile) => describeSwitchPreview(currentProfile, profile)),
    readSafety: "read_only",
    previewReceipt: createPreviewReceipt({
      operation: "hours.switch.preview",
      readinessStatus: "read_only_boundary",
      readinessGate:
        "Hours profile switching remains a local comparison helper and does not change any Reclaim account setting."
    })
  };
}
