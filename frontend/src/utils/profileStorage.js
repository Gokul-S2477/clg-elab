import { apiGet, apiPut } from "./api";
import { createDefaultProfile, readResumeWorkspace, saveResumeWorkspace } from "./resumeBuilderStorage";
import { getResumeSettings } from "./resumeSettings";
import { getStoredUser, isPrivilegedRole } from "./roleHelper";
import { pushAppNotification } from "./appNotifications";

const PROFILE_EVENT = "profile-updated";

export const createProfileDraft = () => ({
  basics: {
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
  },
  summary: "",
  education: [],
  skills: [],
  projects: [],
  experience: [],
  achievements: [],
  certifications: [],
  languages: [],
  targetRole: "",
  careerGoal: "",
});

export const readProfile = (userId = "guest") => {
  const workspace = readResumeWorkspace(userId);
  const base = createDefaultProfile();
  const profile = workspace.profile || base;
  return {
    ...createProfileDraft(),
    ...profile,
    basics: { ...createProfileDraft().basics, ...(profile.basics || {}) },
  };
};

export const fetchProfileFromApi = async (userId) => {
  const payload = await apiGet(`/app/profile/${userId}`);
  return {
    ...createProfileDraft(),
    ...(payload?.data || {}),
    basics: { ...createProfileDraft().basics, ...((payload?.data || {}).basics || {}) },
  };
};

export const saveProfileToApi = async (userId, nextProfile) => {
  const payload = await apiPut(`/app/profile/${userId}`, nextProfile);
  return {
    ...createProfileDraft(),
    ...(payload?.data || {}),
    basics: { ...createProfileDraft().basics, ...((payload?.data || {}).basics || {}) },
  };
};

export const saveProfile = (userId = "guest", nextProfile, options = {}) => {
  const workspace = readResumeWorkspace(userId);
  const profile = {
    ...createProfileDraft(),
    ...nextProfile,
    basics: { ...createProfileDraft().basics, ...(nextProfile?.basics || {}) },
  };
  const nextWorkspace = { ...workspace, profile };
  saveResumeWorkspace(userId, nextWorkspace);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: profile }));
    if (!options.silent) {
      pushAppNotification({
        title: "Profile updated",
        message: "Your profile bank is ready for resume creation and editing.",
        tone: "success",
        href: "/profile",
      });
    }
  }
  return profile;
};

export const canEditProfile = (user = getStoredUser()) => {
  if (isPrivilegedRole(user?.role)) return true;
  return getResumeSettings().studentProfileEditEnabled;
};

export const getProfileEventName = () => PROFILE_EVENT;
