# 11: Freeze the baseline

**What to build:** The baseline exists: all 15 samples run at 5 epochs against the untouched plugin with every role on `claude-opus-5-5`, and the scorecard is committed. From here every fix can be measured.

**Blocked by:** 04 (Run parameters and limits), 05 (Single and fan-out samples with every status), 06 (Python fixture: review-loop and chain samples), 07 (TypeScript fixture: false-pass and panel samples), 08 (Remaining topologies), 09 (Model routing check)

**Status:** done

- [x] The baseline scorecard is committed, keyed by plugin commit, with the full version header
- [x] The measured run-to-run spread per sample is recorded in the scorecard
- [x] The actual cost and duration of a 3-epoch routine run are recorded; if over $30, debate, best-of-n and relay are cut to 1 epoch before any sample is dropped, and the README says what was done
- [x] The README lists the findings the suite cannot measure and how each is verified by hand in a cloud session
- [x] The README states the command to reproduce the baseline and the command to compare a new run against it
- [x] No plugin source changed between the plugin commit in the header and the run
