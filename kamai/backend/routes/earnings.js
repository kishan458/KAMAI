const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

// POST /earnings
// Save a week's earnings entry
router.post('/', async (req, res) => {
  const {
    riderAnonId, platform, weekStart,
    gross, orders, hours, bonus,
    appFee, fuel, tdsApplied, commissionPct
  } = req.body

  if (!riderAnonId || !platform || !gross || !hours || !commissionPct) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const { data, error } = await supabase
      .from('earnings')
      .insert({
        rider_anon_id: riderAnonId,
        platform,
        week_start: weekStart || new Date().toISOString().split('T')[0],
        gross,
        orders: orders || 0,
        hours,
        bonus: bonus || 0,
        app_fee: appFee || 0,
        fuel: fuel || 0,
        tds_applied: tdsApplied || false,
        commission_pct: commissionPct,
      })
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, entry: data })
  } catch (err) {
    console.error('POST /earnings error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /earnings/:riderAnonId
// Get last 100 entries for a rider
router.get('/:riderAnonId', async (req, res) => {
  const { riderAnonId } = req.params

  try {
    const { data, error } = await supabase
      .from('earnings')
      .select('*')
      .eq('rider_anon_id', riderAnonId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    res.json({ entries: data })
  } catch (err) {
    console.error('GET /earnings error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router