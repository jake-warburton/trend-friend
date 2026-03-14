import assert from "node:assert/strict";
import test from "node:test";
import {
  isOwner,
  canAccess,
  type UserPermissionProfile,
} from "@/lib/subscription";

const adminFreeProfile: UserPermissionProfile = {
  isAdmin: true,
  accountTier: "free",
  subscriptionStatus: "none",
};

const proNonAdminProfile: UserPermissionProfile = {
  isAdmin: false,
  accountTier: "pro",
  subscriptionStatus: "active",
};

const freeNonAdminProfile: UserPermissionProfile = {
  isAdmin: false,
  accountTier: "free",
  subscriptionStatus: "none",
};

test("isOwner returns true for admin", () => {
  assert.equal(isOwner(adminFreeProfile), true);
});

test("isOwner returns false for non-admin", () => {
  assert.equal(isOwner(proNonAdminProfile), false);
});

test("canAccess('pro', adminFreeProfile) returns true — admin bypasses tier", () => {
  assert.equal(canAccess("pro", adminFreeProfile), true);
});

test("canAccess('pro', proNonAdminProfile) returns true — active pro sub", () => {
  assert.equal(canAccess("pro", proNonAdminProfile), true);
});

test("canAccess('pro', freeNonAdminProfile) returns false — free user blocked", () => {
  assert.equal(canAccess("pro", freeNonAdminProfile), false);
});

test("canAccess('owner', proNonAdminProfile) returns false — only admin passes", () => {
  assert.equal(canAccess("owner", proNonAdminProfile), false);
});

test("canAccess('owner', adminFreeProfile) returns true — admin is owner", () => {
  assert.equal(canAccess("owner", adminFreeProfile), true);
});

test("canAccess('free', freeNonAdminProfile) returns true — free tier is always accessible", () => {
  assert.equal(canAccess("free", freeNonAdminProfile), true);
});

test("canAccess('pro', trialingProfile) returns true", () => {
  const trialing: UserPermissionProfile = {
    isAdmin: false,
    accountTier: "pro",
    subscriptionStatus: "trialing",
  };
  assert.equal(canAccess("pro", trialing), true);
});

test("canAccess('pro', pastDueProfile) returns false", () => {
  const pastDue: UserPermissionProfile = {
    isAdmin: false,
    accountTier: "pro",
    subscriptionStatus: "past_due",
  };
  assert.equal(canAccess("pro", pastDue), false);
});
