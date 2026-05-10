const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

// POST /checkin
// Rider checks in at a darkstore
router.post('/', async (req, res) => {
  const { rider_anon_id: riderAnonId, darkstore_id: darkstoreId, platform } = req.body

  if (!riderAnonId || !darkstoreId || !platform) {
    return res.status(400).json({ error: 'rider_anon_id, darkstore_id, platform required' })
  }

  try {
    // Mark any existing active checkins for this rider as inactive
    await supabase
      .from('checkins')
      .update({ status: 'inactive' })
      .eq('rider_anon_id', riderAnonId)
      .eq('status', 'active')

    // Create new checkin
    const { data, error } = await supabase
      .from('checkins')
      .insert({
        rider_anon_id: riderAnonId,
        darkstore_id: darkstoreId,
        platform,
        status: 'active',
        checked_in_at: new Date().toISOString(),
        last_ping: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, checkin: data })
  } catch (err) {
    console.error('POST /checkin error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /checkin/ping
// Keep checkin alive — call every 2 minutes from app
router.post('/ping', async (req, res) => {
  const { rider_anon_id: riderAnonId } = req.body

  if (!riderAnonId) {
    return res.status(400).json({ error: 'rider_anon_id required' })
  }

  try {
    const { error } = await supabase
      .from('checkins')
      .update({ last_ping: new Date().toISOString() })
      .eq('rider_anon_id', riderAnonId)
      .eq('status', 'active')

    if (error) throw error

    res.json({ success: true })
  } catch (err) {
    console.error('POST /checkin/ping error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /checkin/leave
// Rider checks out
router.post('/leave', async (req, res) => {
  const { rider_anon_id: riderAnonId } = req.body

  if (!riderAnonId) {
    return res.status(400).json({ error: 'rider_anon_id required' })
  }

  try {
    const { error } = await supabase
      .from('checkins')
      .update({ status: 'inactive' })
      .eq('rider_anon_id', riderAnonId)
      .eq('status', 'active')

    if (error) throw error

    res.json({ success: true })
  } catch (err) {
    console.error('POST /checkin/leave error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router