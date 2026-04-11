import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../index";
import type { User } from "@/types";

const mockSuperAdmin: User = {
  id: "1", name: "Rina", email: "rina@bakeshop.id", password: "admin",
  role: "superadmin", initials: "RW",
};
const mockStaff: User = {
  id: "4", name: "Dewi", email: "dewi@bakeshop.id", password: "admin",
  role: "staff", initials: "DL",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
  });

  describe("login", () => {
    it("loginDirect sets user", () => {
      useAuthStore.getState().loginDirect(mockSuperAdmin);
      expect(useAuthStore.getState().user).not.toBeNull();
      expect(useAuthStore.getState().user?.email).toBe("rina@bakeshop.id");
    });
  });

  describe("logout", () => {
    it("clears user", () => {
      useAuthStore.getState().loginDirect(mockSuperAdmin);
      expect(useAuthStore.getState().user).not.toBeNull();
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe("hasPerm", () => {
    it("superadmin has access to all pages", () => {
      useAuthStore.getState().loginDirect(mockSuperAdmin);
      expect(useAuthStore.getState().hasPerm("dashboard")).toBe(true);
      expect(useAuthStore.getState().hasPerm("pos")).toBe(true);
      expect(useAuthStore.getState().hasPerm("inventory")).toBe(true);
      expect(useAuthStore.getState().hasPerm("orders")).toBe(true);
      expect(useAuthStore.getState().hasPerm("settings")).toBe(true);
    });

    it("staff cannot access pos", () => {
      useAuthStore.getState().loginDirect(mockStaff);
      expect(useAuthStore.getState().hasPerm("pos")).toBe(false);
      expect(useAuthStore.getState().hasPerm("dashboard")).toBe(true);
      expect(useAuthStore.getState().hasPerm("inventory")).toBe(true);
    });

    it("returns false when no user logged in", () => {
      expect(useAuthStore.getState().hasPerm("dashboard")).toBe(false);
    });
  });

  describe("defaultPage", () => {
    it("returns dashboard for superadmin", () => {
      useAuthStore.getState().loginDirect(mockSuperAdmin);
      expect(useAuthStore.getState().defaultPage()).toBe("dashboard");
    });

    it("returns first available page for role", () => {
      useAuthStore.getState().loginDirect(mockStaff);
      expect(useAuthStore.getState().defaultPage()).toBe("dashboard");
    });

    it("returns dashboard when no user", () => {
      expect(useAuthStore.getState().defaultPage()).toBe("dashboard");
    });
  });
});
