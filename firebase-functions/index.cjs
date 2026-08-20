/**
 * Trusted Firebase Auth lifecycle triggers for سوق الجيران.
 *
 * This code runs only inside Firebase Cloud Functions. Never move Admin SDK
 * calls to the browser, Android application, or Supabase client code.
 */
const functions = require("firebase-functions/v1");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

/**
 * Adds the application-level role claim immediately after Firebase creates a
 * user. The update preserves any claims that a trusted administrative process
 * may already have added, and is safe to retry after a transient failure.
 */
exports.assignAuthenticatedRoleOnCreate = functions
  .region("europe-west1")
  .auth.user()
  .onCreate(async (user) => {
    const existingClaims = user.customClaims ?? {};

    if (existingClaims.role === "authenticated") {
      functions.logger.info("Firebase Auth user already has authenticated role", {
        uid: user.uid,
      });
      return null;
    }

    await getAuth().setCustomUserClaims(user.uid, {
      ...existingClaims,
      role: "authenticated",
    });

    functions.logger.info("Assigned authenticated role to Firebase Auth user", {
      uid: user.uid,
    });
    return null;
  });
