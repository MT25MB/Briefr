// Backwards-compatible exports. The real implementation lives in auth.js and db.js.
export {
  bootstrapAuth,
  continueLocalOnly,
  deleteAccount,
  getCurrentAccount,
  isCloudConfigured,
  isLocalOnly,
  onAuthChange,
  signIn,
  signOut,
  signUp,
} from './auth.js'

export { exportAccountData } from './db.js'
