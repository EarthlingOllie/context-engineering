# 09: Model routing check

**What to build:** A role that asks for a different model really gets it, and the suite proves it. Every model a role may request is declared to the bridge, and a sample fails when the model that served a call is not the one requested.

**Blocked by:** 03 (First scored sample and scorecard)

**Status:** done

- [x] Opus, Sonnet and Haiku model ids are declared to the bridge, each with prices
- [x] The scorecard records requested model and serving model per role
- [x] A sample is marked failed when any call's serving model differs from the requested one
- [x] The check is shown working with one role forced to Haiku through a harness option, without changing the plugin
- [x] The baseline configuration still runs every role on `claude-opus-5-5`
