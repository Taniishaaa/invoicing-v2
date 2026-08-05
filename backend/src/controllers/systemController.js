import { getUploadLock, setUploadLock } from '../services/systemService.js'

export async function getUploadLockHandler(req, res) {
  try {
    const lock = await getUploadLock()
    return res.json({ success: true, lock })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function setUploadLockHandler(req, res) {
  try {
    const { isLocked, reason } = req.body
    if (typeof isLocked !== 'boolean')
      return res.status(400).json({ success: false, message: 'isLocked must be a boolean' })
    const lock = await setUploadLock(req.user.id, req.user.name, isLocked, reason)
    return res.json({
      success: true,
      message: isLocked ? 'Uploads locked' : 'Uploads unlocked',
      lock,
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}
