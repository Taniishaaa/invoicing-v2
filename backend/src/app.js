import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import authRoutes       from './routes/authRoutes.js'
import adminRoutes      from './routes/adminRoutes.js'
import hrPartnerRoutes  from './routes/hrPartnerRoutes.js'
import hrRoutes         from './routes/hrRoutes.js'
import financeRoutes    from './routes/financeRoutes.js'
import vendorRoutes     from './routes/vendorRoutes.js'
import systemRoutes     from './routes/systemRoutes.js'
import complianceRoutes from './routes/complianceRoutes.js'
import batchRoutes      from './routes/batchRoutes.js'
import invoiceRoutes    from './routes/invoiceRoutes.js'
import exportRoutes from './routes/exportRoutes.js'

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(cookieParser())
app.use(express.json())

app.get('/health', (req, res) => res.status(200).json({ success: true, message: 'API Running' }))

app.use('/api/auth',        authRoutes)
app.use('/api/admin',       adminRoutes)
app.use('/api/hr-partners', hrPartnerRoutes)
app.use('/api/hr',          hrRoutes)
app.use('/api/finance',     financeRoutes)
app.use('/api/compliance',  complianceRoutes)
app.use('/api/vendor',      vendorRoutes)
app.use('/api/system',      systemRoutes)
app.use('/api/batches',     batchRoutes)
app.use('/api/invoices',    invoiceRoutes)
app.use('/api/export', exportRoutes)

export default app
