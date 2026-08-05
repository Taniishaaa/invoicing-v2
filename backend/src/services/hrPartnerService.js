import bcrypt from 'bcrypt'
import prisma from '../config/prisma.js'

function generatePassword(length = 8) {

  const chars ='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let password = ''

  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

function generateBaseUsername(name) {

  const words = name.trim().toLowerCase().split(/\s+/)

  if (words.length === 1) {
    return words[0]
  }

  return `${words[0]}.${words[1]}`
}

async function generateUsername(name) {

  const baseUsername = generateBaseUsername(name)

  let username = baseUsername
  let counter = 1

  while (true) {
    const existingUser = await prisma.authUser.findUnique({
        where: {
          username
        }
      })

    if (!existingUser) {
      return username
    }
    username =`${baseUsername}${counter}`
    counter++
  }
}

export async function createHrPartner(data) {

  const {name, pan} = data
  const normalizedPan = pan?.trim().toUpperCase()

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(normalizedPan)
) {
  throw new Error('Invalid PAN format')
}

  if (!name || !normalizedPan) {
    throw new Error('All fields are required')
  }

  const existingPartner = await prisma.hrPartner.findUnique({
      where: {
        pan: normalizedPan
      },
      include: {
        user: true
      }
    })

  const password = generatePassword()
  const hashedPassword = await bcrypt.hash(password, 10)

  if (existingPartner) {

    if (!existingPartner.user.isDeleted) {
      throw new Error(
        'PAN already exists'
      )
    }

    await prisma.authUser.update({

      where: {
        id: existingPartner.userId
      },
      data: {
        name,
        password: hashedPassword,
        isActive: true,
        isDeleted: false
      }
    })

    await prisma.hrPartner.update({

      where: {
        id: existingPartner.id
      },
      data: {
        name
      }
    })

    return {
      partner: {
        id: existingPartner.id,
        name,
        pan: normalizedPan,
        username: existingPartner.user.username
      },

      credentials: {
        username: existingPartner.user.username,
        password
      }
    }
  }

  const username = await generateUsername(name)

  const user = await prisma.authUser.create({
      data: {
        username,
        email: `${username}@vendor.local`,
        password: hashedPassword,
        name,
        role: 'vendor',
        isActive: true,
        isDeleted: false
      }
    })

  const partner = await prisma.hrPartner.create({
      data: {
        userId: user.id,
        name,
        pan: normalizedPan
      }
    })

  return {
    partner: {
      id: partner.id,
      name,
      pan: normalizedPan,
      username
    },
    credentials: {
      username,
      password
    }
  }
}

export async function getHrPartners() {
  
    const partners = await prisma.hrPartner.findMany({
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

  return partners.map(partner => ({
    id: partner.id,
    name: partner.name,
    pan: partner.pan,
    username:
      partner.user.username,
    isActive:
      partner.user.isActive,
    isDeleted:
      partner.user.isDeleted,
    createdAt:
      partner.createdAt
  }))
}

export async function toggleHrPartnerStatus(partnerId) {

  const partner = await prisma.hrPartner.findUnique({
      where: {
        id: partnerId
      },
      include: {
        user: true
      }
    })

  if (!partner) {
    throw new Error('HR Partner not found')
  }

  if (partner.user.isDeleted) {
    throw new Error('Deleted HR Partners cannot be reactivated')
  }

  return prisma.authUser.update({
    where: {
      id: partner.userId
    },
    data: {
      isActive:
        !partner.user.isActive
    }
  })
}

export async function deleteHrPartner(partnerId) {

  const partner = await prisma.hrPartner.findUnique({
      where: {
        id: partnerId
      }
    })

  if (!partner) {
    throw new Error('HR Partner not found')
  }

  return prisma.authUser.update({
    where: {
      id: partner.userId
    },
    data: {
      isDeleted: true,
      isActive: false
    }
  })
}

export async function resetHrPartnerPassword(partnerId) {

  const partner = await prisma.hrPartner.findUnique({
      where: {
        id: partnerId
      },
      include: {
        user: true
      }
    })

  if (!partner) {
    throw new Error('HR Partner not found')
  }

  const newPassword = generatePassword()
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.authUser.update({
    where: {
      id: partner.userId
    },
    data: {
      password: hashedPassword
    }
  })

  return {
    username: partner.user.username,
    password: newPassword
  }
}
import { buildInvoiceWhere, fetchInvoices, generateExcel, generateZip } from './exportService.js'

export async function getInvoicesList(filters, page, pageSize) {
  const where = buildInvoiceWhere(filters)
  return fetchInvoices(where, page, pageSize)
}

export { generateExcel, generateZip, buildInvoiceWhere }
