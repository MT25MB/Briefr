// Single entry point for the rest of the app. Real implementation lives in auth.js / db.js.
export {
  auth,
  bootstrapAuth,
  continueLocalOnly,
  deleteAccount,
  getCurrentAccount,
  getSession,
  isCloudConfigured,
  isLocalOnly,
  LocalOnlyGuest,
  onAuthChange,
  onAuthStateChange,
  refreshSession,
  resetPassword,
  sendMagicLink,
  signIn,
  signInWithOAuth,
  signOut,
  signUp,
  updatePassword,
} from './auth.js'

export {
  clearCloudTriage,
  exportAccountData,
  loadCloudData,
  loadCloudTriage,
  saveCloudData,
  saveCloudTriage,
  saveProfile,
} from './db.js'
