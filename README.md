## Phase 0 – Repo & framing (no Copilot yet)

Before you even open the IDE, write this in your head (or README):

**Product sentence**

> “Replay the last 12 months of a household’s energy usage with a simulated solar PV + battery system and compare monthly net cost vs their actual Octopus Energy bill and direct debit.”

**Core constraints**

* Half-hourly resolution
* Deterministic (no ML)
* Local processing
* Pluggable data sources

---

## Phase 1 – Skeleton without logic

Goal: create the shape of the system so Copilot can fill in boxes.

Create empty modules:

```
/src
  /octopus
    client.ts
    types.ts
  /solar
    irradiance.ts
    pv_model.ts
  /battery
    battery_model.ts
  /tariff
    tariff_model.ts
  /simulation
    energy_flow.ts
    monthly_aggregation.ts
  main.ts
```

Copilot prompt style (token-cheap):

> Create TypeScript interfaces for half-hourly energy records, PV generation records, and simulation results. No implementation yet.

You’re teaching it your domain language first.

---

## Phase 2 – Octopus data pull (high value, small surface)

Single bounded task:

> Implement a function that fetches the last 12 months of half-hourly consumption from the Octopus Energy API given an API key and MPAN. Return an array of `{ timestamp, kWh }`. No UI, no storage.

Stop there. Don’t let it drift.

---

## Phase 3 – Solar generation model (simple first)

Avoid asking for “accurate physics”. Ask for:

> Implement a PV generation estimator that converts half-hourly irradiance (W/m²) into kWh output for a system size in kWp using a fixed performance ratio (e.g. 0.85).

That keeps tokens low and logic transparent.

---

## Phase 4 – Battery dispatch (core logic, still tight)

Very precise:

> Implement a greedy battery model:
>
> * Inputs: capacity kWh, max charge/discharge kW, round-trip efficiency
> * For each half-hour:
>
>   * Use PV to meet load
>   * Excess charges battery
>   * Shortfall discharges battery
>   * Remainder imports from grid or exports
>     Return time series of grid import, grid export, battery SoC.

No fluff, no commentary.

---

## Phase 5 – Tariff & cost replay

Prompt:

> Given half-hourly import/export kWh and a tariff with time-of-use rates, compute total cost and revenue per month. Support flat rate first.

Again: narrow.

---

## Phase 6 – Monthly direct debit comparison

This is your differentiator:

> Aggregate monthly net cost and compare against a fixed monthly direct debit. Output running balance (credit/debit) by month.

---

## Phase 7 – Minimal UI or CLI

Only now:

> Create a simple CLI that:
>
> 1. Reads Octopus API key
> 2. Reads system config (PV size, battery size, tariff, DD)
> 3. Runs simulation
> 4. Prints monthly table and cumulative balance

---

## Token-Optimisation Rules for You

These will save you *hundreds of tokens per session*:

### 1. Never say “build an app that…”

Always say:

> In file X, implement function Y with signature Z. Do not add extra features.

### 2. Forbid verbosity explicitly

Add to every Copilot prompt:

> Return only code. No explanation.

### 3. One responsibility per prompt

If you see “and also” in your prompt, split it.

### 4. Lock interfaces early

Once you have:

```ts
interface HalfHourlyRecord {
  timestamp: Date
  kWh: number
}
```

Reuse it everywhere so Copilot doesn’t reinvent shapes.

---

## Phase Order Summary (printable roadmap)

1. Define core data types (no logic)
2. Octopus consumption fetch
3. Solar irradiance ingestion
4. PV generation model
5. Battery dispatch model
6. Grid import/export calculation
7. Tariff cost engine
8. Monthly aggregation
9. Direct debit comparison
10. CLI / minimal UI
11. Visualisation (later, optional)

---