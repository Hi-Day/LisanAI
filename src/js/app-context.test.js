import { describe, expect, it, vi } from "vitest";

describe("bootstrapAuthenticatedApp", () => {
  it("loads state and admin users concurrently", async () => {
    vi.resetModules();
    const loadState = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve({ assessments: [], submissions: [], classes: [], memberships: [] }), 20)));
    const loadUsers = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve([{ id: "u1" }]), 20)));
    const createSession = vi.fn((state) => ({ ensureAssessmentSelected: vi.fn(), state }));

    vi.doMock("./storage.js", () => ({ loadState }));
    vi.doMock("./session.js", () => ({ createSession }));
    vi.doMock("./recorder.js", () => ({ createRecorder: () => ({}) }));
    vi.doMock("./dom.js", () => ({ getElements: () => ({}) }));
    vi.doMock("./render.js", () => ({ renderApp: vi.fn(), renderStudentHistory: vi.fn() }));
    vi.doMock("./toast.js", () => ({ showToast: vi.fn() }));
    vi.doMock("./utils.js", () => ({ roleLabel: vi.fn(), escapeHtml: vi.fn() }));
    vi.doMock("./api.js", () => ({ listUsers: loadUsers, getSimulationData: vi.fn() }));

    const { bootstrapAuthenticatedApp } = await import("./app-context.js");
    const ctx = {
      auth: null,
      state: null,
      users: [],
      session: null,
      els: { loginForm: { reset: vi.fn() }, registerForm: { reset: vi.fn() } },
    };

    const started = Date.now();
    await bootstrapAuthenticatedApp(ctx, { user: { role: "admin" }, tenant: { name: "Tenant" } });
    const elapsed = Date.now() - started;

    expect(loadState).toHaveBeenCalledTimes(1);
    expect(loadUsers).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith(ctx.state);
    expect(ctx.users).toEqual([{ id: "u1" }]);
    expect(elapsed).toBeLessThan(38);
  });
});
