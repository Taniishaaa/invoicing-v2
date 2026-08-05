import prisma from '../config/prisma.js'
import {verifyToken} from '../utils/jwt.js'

export const authenticate =
  async (
    req,
    res,
    next
  ) => {

    try {

      const token =
        req.cookies.token

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        })
      }

      const decoded =
        verifyToken(token)

      const user =
  await prisma.authUser.findUnique({
    where: {
      id: decoded.userId
    },
    include: {
      hrPartner: true
    }
  })

      if (
        !user ||
        user.isDeleted ||
        !user.isActive
      ) {
        return res.status(401).json({
          success: false,
          message: 'Invalid session'
        })
      }

req.user = {
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,

  role: user.role,
  subRole: user.subRole,

  isActive: user.isActive,
  createdAt: user.createdAt,

  pan: user.hrPartner?.pan || null
}

      next()
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid session'
      })
    }
  }

export const authorize =
  (...roles) =>
  (
    req,
    res,
    next
  ) => {

    if (
      !roles.includes(
        req.user.role
      )
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    next()
  }