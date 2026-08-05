import {loginUser, changePassword} from '../services/authService.js'
import {generateToken} from '../utils/jwt.js'

export const login = async (
  req,
  res
) => {
  try {

    const {
      username,
      password
    } = req.body

    const user = await loginUser(
      username,
      password
    )

    const token = generateToken(user)

    res.cookie(
      'token',
      token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:
          7 * 24 * 60 * 60 * 1000
      }
    )

return res.status(200).json({
  success: true,
  user: {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    subRole: user.subRole
  }
})

  } catch (error) {

    return res.status(401).json({
      success: false,
      message: error.message
    })
  }
}

export const me = async (
  req,
  res
) => {

  return res.status(200).json({
    success: true,
    user: req.user
  })
}

export const logout = async (
  req,
  res
) => {

  res.clearCookie('token')

  return res.status(200).json({
    success: true,
    message: 'Logged out'
  })
}

export const changePasswordHandler = async (req, res) => {

    try {
      const {currentPassword, newPassword} = req.body

      await changePassword(
        req.user.id,
        currentPassword,
        newPassword
      )

      return res.json({
        success: true,
        message:
          'Password updated successfully'
      })

    } catch (error) {

      return res.status(400).json({
        success: false,
        message: error.message
      })
    }
  }