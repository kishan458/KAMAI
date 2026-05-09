const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

// GET /darkstores
// Returns all darkstores with live rider counts + scarcity scores
router.get('/', async (req, res) => {
  try {
    // Get all darkstores
    const { data: darkstores, error: dsError } = await supabase
      .from('darkstores')
      .select('*')

    if (dsError) throw dsError

    // Get active checkins (pinged in last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: checkins, error: ciError } = await supabase
      .from('checkins')
      .select('darkstore_id')
      .eq('status', 'active')
      .gte('last_ping', tenMinutesAgo)

    if (ciError) throw ciError

    // Count riders per darkstore
    const riderCounts = {}
    checkins.forEach(c => {
      riderCounts[c.darkstore_id] = (riderCounts[c.darkstore_id] || 0) + 1
    })

    const BASELINE_RIDERS = 8

    // Attach scarcity scores to each darkstore
    const result = darkstores.map(store => {
      const activeRiders = riderCounts[store.id] || 0
      const scarcityScore = Math.max(0, BASELINE_RIDERS - activeRiders)

      let opportunity = 'BALANCED'
      if (scarcityScore >= 5) opportunity = 'HOT'
      else if (scarcityScore >= 2) opportunity = 'WARM'

      return {
        ...store,
        activeRiders,
        scarcityScore,
        opportunity,
        ridersNeeded: scarcityScore,
      }
    })

    // Sort by most scarce first
    result.sort((a, b) => b.scarcityScore - a.scarcityScore)

    res.json({ darkstores: result })
  } catch (err) {
    console.error('GET /darkstores error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router