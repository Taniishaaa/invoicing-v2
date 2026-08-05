import bcrypt from 'bcrypt'
import prisma from '../config/prisma.js'

function generatePassword(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

function generateBaseUsername(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '.')
}

async function generateUsername(name) {
  const baseUsername = generateBaseUsername(name)
  let username = baseUsername
  let counter = 1
  while (true) {
    const existingUser = await prisma.authUser.findUnique({ where: { username } })
    if (!existingUser) return username
    username = `${baseUsername}${counter}`
    counter++
  }
}

export async function createAdmin(data) {
  const { name, email, password, role, subRole } = data

  if (!name || !email || !password || !role) {
    throw new Error('All fields are required')
  }

  if (role === 'hr_team') {
    if (!['hr_maker', 'hr_checker', 'hr_approver'].includes(subRole)) {
      throw new Error('Invalid HR sub role')
    }
  }
  if (role === 'finance_team') {
    if (!['finance_maker', 'finance_checker'].includes(subRole)) {
      throw new Error('Invalid Finance sub role')
    }
  }
  if (role === 'compliance_team') {
    if (subRole !== 'compliance') {
      throw new Error('Invalid Compliance sub role')
    }
  }

  const existingUser = await prisma.authUser.findUnique({ where: { email } })
  const hashedPassword = await bcrypt.hash(password, 10)

  if (existingUser) {
    if (!existingUser.isDeleted) throw new Error('Email already exists')
    return prisma.authUser.update({
      where: { id: existingUser.id },
      data: { name, password: hashedPassword, role, subRole, isActive: true, isDeleted: false },
      select: { id:true, name:true, email:true, username:true, role:true, subRole:true, isActive:true, isDeleted:true, createdAt:true },
    })
  }

  const username = await generateUsername(name)
  return prisma.authUser.create({
    data: { name, email, username, password: hashedPassword, role, subRole, isActive: true, isDeleted: false },
    select: { id:true, name:true, email:true, username:true, role:true, subRole:true, isActive:true, isDeleted:true, createdAt:true },
  })
}

export async function getAdmins() {
  return prisma.authUser.findMany({
    where: { role: { in: ['hr_team', 'finance_team', 'compliance_team'] } },
    select: { id:true, name:true, email:true, username:true, role:true, subRole:true, isActive:true, isDeleted:true, createdAt:true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function toggleAdminStatus(adminId, currentUserId) {
  if (adminId === currentUserId) throw new Error('You cannot deactivate your own account')
  const admin = await prisma.authUser.findUnique({ where: { id: adminId } })
  if (!admin) throw new Error('Admin not found')
  if (admin.isDeleted) throw new Error('Deleted admins cannot be reactivated')
  return prisma.authUser.update({ where: { id: adminId }, data: { isActive: !admin.isActive } })
}

export async function deleteAdmin(adminId, currentUserId) {
  if (adminId === currentUserId) throw new Error('You cannot delete your own account')
  return prisma.authUser.update({
    where: { id: adminId },
    data: { isDeleted: true, isActive: false },
  })
}

export async function resetPassword(adminId) {
  const admin = await prisma.authUser.findUnique({ where: { id: adminId } })
  if (!admin) throw new Error('Admin not found')
  const newPassword = generatePassword()
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.authUser.update({ where: { id: adminId }, data: { password: hashedPassword } })
  return { username: admin.username, password: newPassword }
}

export async function getDashboardStats() {
  const [
    totalPartners, activePartners, totalInvoices,
    extractionCounts, hrStatusCounts, complianceStatusCounts, financeStatusCounts, recentBatches,
  ] = await Promise.all([
    prisma.hrPartner.count(),
    prisma.hrPartner.count({ where: { user: { isActive: true, isDeleted: false } } }),
    prisma.invoice.count({ where: { isDeleted: false } }),
    prisma.invoice.groupBy({ by: ['extractionStatus'], where: { isDeleted: false }, _count: true }),
    prisma.invoiceStatus.groupBy({ by: ['hrStatus'], _count: true }),
    prisma.invoiceStatus.groupBy({ by: ['complianceStatus'], _count: true }),
    prisma.invoiceStatus.groupBy({ by: ['financeStatus'], _count: true }),
    prisma.uploadBatch.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
  hrPartner: {
    select: {
      name: true
    }
  },

  invoices: {
    where: {
      isDeleted: false
    },

    select: {
      id: true
    }
  }
},
    }),
  ])

  const extraction = {}
  for (const row of extractionCounts) extraction[row.extractionStatus] = row._count

  const hrStatus = {}
  for (const row of hrStatusCounts) hrStatus[row.hrStatus] = row._count

  const complianceStatus = {}
  for (const row of complianceStatusCounts) complianceStatus[row.complianceStatus] = row._count

  const financeStatus = {}
  for (const row of financeStatusCounts) financeStatus[row.financeStatus] = row._count

  return {
    partners: { total: totalPartners, active: activePartners, inactive: totalPartners - activePartners },
    invoices: {
      total:      totalInvoices,
      pending:    extraction.pending    ?? 0,
      processing: extraction.processing ?? 0,
      completed:  extraction.completed  ?? 0,
      failed:     extraction.failed     ?? 0,
    },
    hrStatus: {
      pending:  hrStatus.pending  ?? 0,
      approved: hrStatus.approved ?? 0,
      rejected: hrStatus.rejected ?? 0,
    },
    complianceStatus: {
      pending:  complianceStatus.pending  ?? 0,
      verified: complianceStatus.verified ?? 0,
      rejected: complianceStatus.rejected ?? 0,
    },
    financeStatus: {
      pending:       financeStatus.pending        ?? 0,
      makerVerified: financeStatus.maker_verified ?? 0,
      cleared:       financeStatus.cleared        ?? 0,
      rejected:      financeStatus.rejected       ?? 0,
    },
   recentBatches: recentBatches.map(b => ({
  id: b.id,
  hrPartner: b.hrPartner.name,
  project: b.project,
  nature: b.nature,

  totalFiles: b.invoices.length,
invoiceCount: b.invoices.length,

  createdAt: b.createdAt,
})),
  }
}

export async function getFunnel() {
  const stageCounts = await prisma.invoiceStatus.groupBy({
    by: ['currentStage'],
    _count: true,
  })

  // Build per-stage value sums
  const stageValueMap = {}
  const invoices = await prisma.invoice.findMany({
    where: { isDeleted: false },
    select: { invoiceValue: true, status: { select: { currentStage: true } } },
  })
  for (const inv of invoices) {
    const stage = inv.status?.currentStage ?? 'uploaded'
    if (!stageValueMap[stage]) stageValueMap[stage] = 0
    stageValueMap[stage] += inv.invoiceValue ? Number(inv.invoiceValue) : 0
  }

  const countMap = {}
  for (const row of stageCounts) countMap[row.currentStage] = row._count

  function s(key) {
    return { count: countMap[key] ?? 0, value: stageValueMap[key] ?? 0 }
  }

  // Map extraction-status-only invoices (no InvoiceStatus record yet)
  const noStatus = await prisma.invoice.count({
    where: { isDeleted: false, status: null },
  })
  const noStatusParsing = await prisma.invoice.count({
    where: { isDeleted: false, status: null, extractionStatus: { in: ['pending', 'processing'] } },
  })
  const noStatusFailed = await prisma.invoice.count({
    where: { isDeleted: false, status: null, extractionStatus: 'failed' },
  })

  return {
    parsing:             { count: (s('uploaded').count) + noStatusParsing, value: s('uploaded').value },
    parseFailed:         { count: noStatusFailed,                           value: 0 },
    hrMakerPending:      s('extracted'),
    hrCheckerPending:    s('hr_maker_verified'),
    hrApproverPending:   s('hr_checker_reviewed'),
    compliancePending:   s('hr_approved'),
    financeMakerPending: s('compliance_verified'),
    financeCheckerPending: s('finance_maker_verified'),
    paymentPending:      s('finance_cleared'),
    paid:                s('paid'),
    rejected:            s('rejected'),
  }
}
