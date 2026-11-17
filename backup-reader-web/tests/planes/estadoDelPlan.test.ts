import { describe, expect, it, vi } from "vitest";

/* estadoDelPlan es pura, pero el módulo importa el Admin SDK y Stripe. */
vi.mock("../../lib/admin-servidor", () => ({ appDeAdmin: () => null, dbAdmin: () => null }));
vi.mock("../../lib/stripe-servidor", () => ({ todasLasSuscripciones: async () => ({ clientes: 0, suscripciones: [] }) }));

import { estadoDelPlan } from "../../lib/sincronizar-plan";

const AHORA = Date.UTC(2026, 10, 17) ;
const s = (o: Record<string, unknown>) =>
  ({
    status: "active",
    cancel_at: null,
    cancel_at_period_end: false,
    current_period_end: AHORA / 1000 + 86400 * 20,
    ended_at: null,
    canceled_at: null,
    items: { data: [{ plan: { id: "personal" } }] },
    ...o,
  }) as any;

describe("estadoDelPlan", () => {
  it("sin suscripciones no cambia nada", () => {
    expect(estadoDelPlan([], AHORA)).toEqual({ tipo: "sin-cambios" });
  });

  it("activa: el plan sin fecha de fin", () => {
    expect(estadoDelPlan([s({})], AHORA)).toEqual({ tipo: "plan", plan: "personal", planCancelAt: null });
  });

  it("activa y programada para cancelarse: fecha de fin del periodo", () => {
    const fin = AHORA / 1000 + 86400 * 5;
    expect(estadoDelPlan([s({ cancel_at_period_end: true, current_period_end: fin })], AHORA)).toEqual({
      tipo: "plan",
      plan: "personal",
      planCancelAt: fin * 1000,
    });
  });

  it("volver a contratar: la nueva gana a la vieja cancelada (el caso de BACKPUP50)", () => {
    const vieja = s({ status: "canceled", ended_at: AHORA / 1000 - 86400 * 2 });
    const nueva = s({});
    expect(estadoDelPlan([vieja, nueva], AHORA)).toEqual({ tipo: "plan", plan: "personal", planCancelAt: null });
  });

  it("entre dos activas, la que no se va a cancelar", () => {
    const seVa = s({ cancel_at_period_end: true, current_period_end: AHORA / 1000 + 86400 * 30, items: { data: [{ plan: { id: "pro" } }] } });
    const sigue = s({ current_period_end: AHORA / 1000 + 86400 * 10 });
    expect(estadoDelPlan([seVa, sigue], AHORA).tipo === "plan" && (estadoDelPlan([seVa, sigue], AHORA) as any).plan).toBe("personal");
  });

  it("cobro fallido en reintento (past_due): sigue con acceso", () => {
    expect(estadoDelPlan([s({ status: "past_due" })], AHORA)).toEqual({ tipo: "plan", plan: "personal", planCancelAt: null });
  });

  it("impagada (unpaid): se corta, con fecha que no queda en el futuro", () => {
    const r = estadoDelPlan([s({ status: "unpaid" })], AHORA) as any;
    expect(r.tipo).toBe("plan");
    expect(r.planCancelAt).toBeLessThanOrEqual(AHORA);
  });

  it("cancelada desde Stripe: termina en ended_at", () => {
    const fin = AHORA / 1000 - 3600;
    expect(estadoDelPlan([s({ status: "canceled", ended_at: fin })], AHORA)).toEqual({
      tipo: "plan",
      plan: "personal",
      planCancelAt: fin * 1000,
    });
  });

  it("solo un pago sin confirmar (incomplete): sin cambios", () => {
    expect(estadoDelPlan([s({ status: "incomplete" })], AHORA)).toEqual({ tipo: "sin-cambios" });
  });
});
