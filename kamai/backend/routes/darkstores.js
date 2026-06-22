const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

const BASELINE_RIDERS = 8

// GET /darkstores
//   - no params        -> ALL darkstores (for map markers) — SAME AS BEFORE
//   - ?lat=&lon=        -> nearest 20 darkstores to that point (for the list)
//   - ?lat=&lon=&limit= -> nearest N (max 100)
//
// Response shape is UNCHANGED from before: { darkstores: [...] }
// Each store still has: id, name, platform, area, city, address,
// latitude, longitude, activeRiders, scarcityScore, opportunity, ridersNeeded
router.get('/', async (req, res) => {
  try {
    const { lat, lon, limit } = req.query
    const wantNearest = lat !== undefined && lon !== undefined

    let darkstores

    if (wantNearest) {
      const latNum = parseFloat(lat)
      const lonNum = parseFloat(lon)
      if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
        return res.status(400).json({ error: 'lat and lon must be valid numbers' })
      }
      const nLimit = Math.min(parseInt(limit, 10) || 20, 100)

      const { data, error } = await supabase.rpc('nearest_darkstores', {
        rider_lat: latNum,
        rider_lon: lonNum,
        result_limit: nLimit,
      })
      if (error) throw error

      darkstores = data.map(s => ({
        ...s,
        latitude: s.lat,
        longitude: s.lon,
      }))
    } else {
      const { data, error } = await supabase.rpc('get_darkstores_with_coords')
      if (error) throw error
      darkstores = data
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: checkins, error: ciError } = await supabase
      .from('checkins')
      .select('darkstore_id')
      .eq('status', 'active')
      .gte('last_ping', tenMinutesAgo)

    if (ciError) throw ciError

    const riderCounts = {}
    checkins.forEach(c => {
      riderCounts[c.darkstore_id] = (riderCounts[c.darkstore_id] || 0) + 1
    })

    const result = darkstores.map(store => {
      const activeRiders = riderCounts[store.id] || 0
      const scarcityScore = Math.max(0, BASELINE_RIDERS - activeRiders)

      let opportunity = 'BALANCED'
      if (scarcityScore >= 5) opportunity = 'HOT'
      else if (scarcityScore >= 2) opportunity = 'WARM'

      return {
        id: store.id,
        name: store.name,
        platform: store.platform,
        area: store.area,
        city: store.city,
        address: store.address,
        latitude: store.latitude,
        longitude: store.longitude,
        distanceKm: store.distance_km ?? undefined,
        activeRiders,
        scarcityScore,
        opportunity,
        ridersNeeded: scarcityScore,
      }
    })

    if (!wantNearest) {
      result.sort((a, b) => b.scarcityScore - a.scarcityScore)
    }

    res.json({ darkstores: result })
  } catch (err) {
    console.error('GET /darkstores error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router