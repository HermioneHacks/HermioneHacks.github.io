export default function handler(req, res) {
  // Read from environment variables set in Vercel Project Settings → Environment Variables
  const {
    FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID,
    FIREBASE_MEASUREMENT_ID,
  } = process.env;

  // Return a small JS snippet that sets window.FIREBASE_CONFIG at runtime
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.FIREBASE_CONFIG = ${JSON.stringify({
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: FIREBASE_STORAGE_BUCKET,
    messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
    appId: FIREBASE_APP_ID,
    measurementId: FIREBASE_MEASUREMENT_ID,
  })};`);
}


