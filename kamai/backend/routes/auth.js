// backend/routes/auth.js
const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const crypto = require('crypto')

// Simple password hash — no bcrypt dependency needed
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'kamai_salt_2024').digest('hex')
}

// ── POST /auth/signup ──
router.post('/signup', async (req, res) => {
  try {
    const { email, phone, password, city } = req.body

    if (!password || password.length < 6) {
      return res.json({ error: 'Password must be at least 6 characters' })
    }
    if (!email && !phone) {
      return res.json({ error: 'Email or phone number required' })
    }

    const hashedPassword = hashPassword(password)

    // Check if already exists
    let existingQuery = supabase.from('users').select('id')
    if (email) existingQuery = existingQuery.eq('email', email.toLowerCase())
    else existingQuery = existingQuery.eq('phone', phone)

    const { data: existing } = await existingQuery.single()
    if (existing) {
      return res.json({ error: 'Account already exists. Please log in.' })
    }

    // Create user
    const insertData = {
      city: city || 'bengaluru',
      password_hash: hashedPassword,
      ...(email ? { email: email.toLowerCase() } : { phone }),
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert(insertData)
      .select('id, email, phone, city, created_at')
      .single()

    if (error) {
      console.error('Signup error:', error)
      return res.json({ error: 'Could not create account. Try again.' })
    }

    res.json({ user })
  } catch (e) {
    console.error('Signup exception:', e)
    res.json({ error: 'Server error. Try again.' })
  }
})

// ── POST /auth/login ──
router.post('/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body

    if (!password) {
      return res.json({ error: 'Password required' })
    }

    const hashedPassword = hashPassword(password)

    let query = supabase
      .from('users')
      .select('id, email, phone, city, created_at, password_hash')

    if (email) query = query.eq('email', email.toLowerCase())
    else if (phone) query = query.eq('phone', phone)
    else return res.json({ error: 'Email or phone required' })

    const { data: user, error } = await query.single()

    if (error || !user) {
      return res.json({ error: 'No account found. Please sign up first.' })
    }

    if (user.password_hash !== hashedPassword) {
      return res.json({ error: 'Wrong password. Try again.' })
    }

    // Don't send password hash to client
    const { password_hash, ...safeUser } = user
    res.json({ user: safeUser })
  } catch (e) {
    console.error('Login exception:', e)
    res.json({ error: 'Server error. Try again.' })
  }
})

module.exports = router