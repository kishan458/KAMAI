require('dotenv').config()
const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const supabase = require('./lib/supabase')

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

app.use(cors())
app.use(express.json())

const authRoutes = require('./routes/auth')
app.use('/auth', authRoutes)

// ── Routes ──
app.use('/darkstores', require('./routes/darkstores'))
app.use('/checkin', require('./routes/checkin'))
app.use('/earnings', require('./routes/earnings'))

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'kamai-backend', version: '1.0.0' })
})

// ── Socket.io ──
io.on('connection', (socket) => {
  console.log('Rider connected:', socket.id)

  // Rider joins city room
  socket.on('rider:subscribe', ({ city }) => {
    socket.join(city || 'bengaluru')
    console.log(`Socket ${socket.id} joined room: ${city || 'bengaluru'}`)
  })

  socket.on('disconnect', () => {
    console.log('Rider disconnected:', socket.id)
  })
})

// ── Controlled Release: Scarcity Broadcast ──
// Runs every 60 seconds — checks for HOT darkstores and notifies only closest riders
async function broadcastScarcity() {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const BASELINE_RIDERS = 8

    const { data: darkstores } = await supabase.from('darkstores').select('*')
    const { data: checkins } = await supabase
      .from('checkins')
      .select('darkstore_id')
      .eq('status', 'active')
      .gte('last_ping', tenMinutesAgo)

    const riderCounts = {}
    checkins?.forEach(c => {
      riderCounts[c.darkstore_id] = (riderCounts[c.darkstore_id] || 0) + 1
    })

    darkstores?.forEach(store => {
      const activeRiders = riderCounts[store.id] || 0
      const scarcityScore = Math.max(0, BASELINE_RIDERS - activeRiders)

      if (scarcityScore >= 3) {
        // Broadcast to city room — controlled release logic lives in frontend
        io.to(store.city || 'bengaluru').emit('scarcity:update', {
          darkstoreId: store.id,
          darkstoreName: store.name,
          platform: store.platform,
          area: store.area,
          scarcityScore,
          ridersNeeded: scarcityScore,
          opportunity: scarcityScore >= 5 ? 'HOT' : 'WARM',
        })
      }
    })
  } catch (err) {
    console.error('broadcastScarcity error:', err)
  }
}

setInterval(broadcastScarcity, 60 * 1000)

// ── Auto-expire stale checkins every 5 minutes ──
async function expireStaleCheckins() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('checkins')
    .update({ status: 'inactive' })
    .eq('status', 'active')
    .lt('last_ping', tenMinutesAgo)

  if (error) console.error('expireStaleCheckins error:', error)
  else console.log('Stale checkins expired at', new Date().toISOString())
}

setInterval(expireStaleCheckins, 5 * 60 * 1000)

// ── Start ──
const PORT = process.env.PORT || 3001
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Kamai backend running on http://0.0.0.0:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})