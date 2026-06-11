# TODO

A personal checklist of things **I** need to do. Mark items off with `[x]` when done.

## Now / Deploy

- [ ] Pull latest on the deploy box and rebuild the frontend:
      `cd ~/Downloads/LUTS.shop/luts_store/aws && git pull origin claude/keen-bohr-pp97ad && ./deploy-all.sh --only 4`
- [ ] Hard-refresh http://107.23.187.255/ and confirm the top nav shows:
      **Cinematic · DJI / OSMO · Bundles · Explore**
- [ ] Click **Explore** and confirm it opens `/search` (browse all looks with filters)

## Verify

- [ ] Test the **product upload** flow end-to-end (after the endpoint fix)
- [ ] Confirm the **download path** works after a successful upload
- [ ] Spot-check that removed categories (Drone, Mobile / CapCut) are still
      reachable via Explore/search and their pages still load

## Decisions to make

- [ ] Decide: fully hide the **Drone** and **Mobile / CapCut** collections,
      or leave them browsable (just out of the nav)?
- [ ] Decide final position/label for **Explore** (currently last in the nav)

## Notes

- Frontend changes require deploy step 4 (rebuild) to go live.
- Branch: `claude/keen-bohr-pp97ad`
