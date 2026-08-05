import jwt from 'jsonwebtoken'

export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      subRole: user.subRole
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  )
}

export const verifyToken = (token) => {
  return jwt.verify(
    token,
    process.env.JWT_SECRET
  )
}