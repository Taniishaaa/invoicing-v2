import bcrypt from 'bcrypt'
import prisma from '../config/prisma.js'

export const loginUser = async (
  username,
  password
) => {

  const user = await prisma.authUser.findUnique({
    where: {
      username
    }
  })

  if (!user) {
    throw new Error('Invalid username or password')
  }

  if (user.isDeleted) {
    throw new Error('User account deleted')
  }

  if (!user.isActive) {
    throw new Error('User account inactive')
  }

  const isMatch = await bcrypt.compare(
    password,
    user.password
  )

  if (!isMatch) {
    throw new Error('Invalid username or password')
  }

  return user
}

export async function changePassword(
  userId,
  currentPassword,
  newPassword
) {

  const user = await prisma.authUser.findUnique({
      where: {
        id: userId
      }
    })

  const valid = await bcrypt.compare(
      currentPassword,
      user.password
    )

  if (!valid) {
    throw new Error('Current password is incorrect')
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.authUser.update({
    where: {
      id: userId
    },
    data: {
      password: hashedPassword
    }
  })
}