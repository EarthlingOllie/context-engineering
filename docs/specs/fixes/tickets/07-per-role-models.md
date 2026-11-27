# 07: Per-role models: scribe and partition on Haiku

**What to build:** Mechanical roles stop costing the session model's price. Agent options and role entries gain an optional model; a per-role default table puts scribe and partition on Haiku and leaves every other role on the session model. A dispatch spec may name a model per role, which is how evaluator, reducer or judge are opted into Sonnet. COST-01 and COST-02(a). If ticket 01 shows the runtime ignores a model choice, close this ticket as dropped.

**Blocked by:** 01 (Spike: model choice on agent(), and the cause of cache writes)

**Status:** ready-for-agent

- [ ] At the dispatch seam: scribe and partition calls carry the Haiku default; a spec's role model overrides the default; other roles carry no model
- [ ] The catalog documents the per-role model field and that Sonnet for evaluator, reducer and judge is opt-in
- [ ] Dispatch evals: every sample's dollars drop below the baseline spread, pass rates and false passes stay within it, and the routing check reports no misrouted call
