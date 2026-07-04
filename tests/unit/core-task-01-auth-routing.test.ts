import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signOutMock = vi.fn();
const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  usePathname: () => "/requests",
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  },
}));

function mockSuccessfulLogin(role: string) {
  signInWithPasswordMock.mockResolvedValue({
    data: {
      session: { access_token: "access-token-001" },
      user: {
        user_metadata: {
          role,
          full_name: `${role} User`,
          sbu_name: "Demo SBU",
          sbu_id: "sbu-001",
        },
      },
    },
    error: null,
  });
}

describe("core-task-01-auth-routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    getSessionMock.mockResolvedValue({ data: { session: null } });
    signOutMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it.each([
    ["BU_MANAGER", "/requests"],
    ["UNIT_STAFF", "/requests"],
    ["WAREHOUSE_MANAGER", "/warehouse/queue"],
  ])("routes %s to the correct dashboard after login", async (role, expectedRoute) => {
    mockSuccessfulLogin(role);
    const { default: LoginPage } = await import("../../app/page");

    render(React.createElement(LoginPage));

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: `${role.toLowerCase()}@example.com` },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "Password@123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(expectedRoute);
    });
    expect(localStorage.getItem("access_token")).toBe("access-token-001");
    expect(localStorage.getItem("user_role")).toBe(role);
  });

  it("logs out by clearing local storage and returning to the login page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("[]", { status: 200 }))),
    );
    localStorage.setItem("access_token", "demo-token-123456");
    localStorage.setItem("user_role", "BU_MANAGER");
    localStorage.setItem("user_name", "Branch Manager");
    localStorage.setItem("user_sbu", "Demo SBU");

    const { default: DashboardLayout } = await import("../../components/DashboardLayout");

    render(
      React.createElement(
        DashboardLayout,
        null,
        React.createElement("div", null, "Dashboard body"),
      ),
    );

    await screen.findByText("Dashboard body");
    fireEvent.click(screen.getByLabelText(/open profile menu/i));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/");
    });
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("redirects protected layouts to login when no access token is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("[]", { status: 200 }))),
    );
    getSessionMock.mockResolvedValue({ data: { session: null } });

    const { default: DashboardLayout } = await import("../../components/DashboardLayout");

    render(
      React.createElement(
        DashboardLayout,
        null,
        React.createElement("div", null, "Protected dashboard body"),
      ),
    );

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("Protected dashboard body")).toBeNull();
  });

  it("forces redirect to login when an API call returns 401", async () => {
    const originalFetch = vi.fn(() => Promise.resolve(new Response(null, { status: 401 })));
    vi.stubGlobal("fetch", originalFetch);
    localStorage.setItem("access_token", "expired-token");

    const { default: AuthGuard } = await import("../../components/AuthGuard");
    render(React.createElement(AuthGuard));

    await fetch("/api/protected");

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
    expect(localStorage.getItem("access_token")).toBeNull();
  });
});
