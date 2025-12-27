import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import * as admin from 'firebase-admin';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin (ensure service account is available or uses default credentials)
// For Render, we might need to rely on strict env vars or a service account file
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Auth Middleware to mimic Firebase Callable Context
const validateFirebaseIdToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer '))) {
    res.status(403).send('Unauthorized');
    return;
  }

  const idToken = req.headers.authorization.split('Bearer ')[1];
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    (req as any).user = decodedIdToken;
    next();
  } catch (error) {
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized');
  }
};

// setRole Implementation (adapted from setRole.ts logic)
app.post('/api/setRole', validateFirebaseIdToken, async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  
  // 1. Check Auth (already done by middleware, but check existence)
  if (!user) {
      return res.status(401).json({ error: 'unauthenticated', message: 'The function must be called while authenticated.' });
  }

  // 2. Check Admin
  // Note: We use the token claims. 
  // IMPORTANT: For the very first admin, manual entry in DB or claims is needed.
  if (!user.admin) {
      return res.status(403).json({ error: 'permission-denied', message: 'Only admins can set roles.' });
  }

  const { uid, role } = req.body;

  // 3. Validation
  if (!uid || !role) {
      return res.status(400).json({ error: 'invalid-argument', message: "The function must be called with 'uid' and 'role' arguments." });
  }

  const validRoles = ["admin", "club", "student"];
  if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'invalid-argument', message: `Role must be one of: ${validRoles.join(", ")}` });
  }

  // 4. Logic
  const claims: { [key: string]: boolean } = {};
  if (role === "admin") claims.admin = true;
  if (role === "club") claims.club = true;

  try {
    await admin.auth().setCustomUserClaims(uid, claims);
    
    // Optional: Update Firestore
    await admin.firestore().collection("users").doc(uid).set(
      { role },
      { merge: true }
    );

    return res.json({ result: { success: true } }); // Structure matches Callable response
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'internal', message: 'Error setting role' });
  }
});

// Basic Health Check
app.get('/', (req, res) => {
  res.send('UniEvent Backend is Running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
