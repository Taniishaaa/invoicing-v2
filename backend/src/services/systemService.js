import prisma from '../config/prisma.js'

const LOCK_ID = 'singleton'

// Get or create the lock record
async function getLock() {
  let lock = await prisma.uploadLock.findFirst()
  if (!lock) {
    lock = await prisma.uploadLock.create({
      data: { id: LOCK_ID, isLocked: false }
    })
  }
  return lock
}

export async function getUploadLock() {
  return getLock()
}

export async function setUploadLock(userId, userName, isLocked, reason) {

  const lock = await getLock()

  return prisma.uploadLock.update({
    where: { id: lock.id },
    data: {
      isLocked,
      reason:       isLocked ? (reason ?? null) : null,
      lockedById:   userId,
      lockedByName: userName,
      lockedAt:     new Date(),
    }
  })
}
