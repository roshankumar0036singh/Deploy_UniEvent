import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createUserWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { auth, db } from './firebaseConfig';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null); // New state for Firestore data
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState([]);

  useEffect(() => {
    loadSavedAccounts(); // Load accounts on mount
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        let userRole = 'student';
        let dbData = {};
        
        // 1. Check Custom Claims (Preferred)
        const tokenResult = await currentUser.getIdTokenResult().catch(() => ({ claims: {} }));
        if (tokenResult.claims.admin) userRole = 'admin';
        else if (tokenResult.claims.club) userRole = 'club';
        
        // 2. Fallback: Check Firestore Document
        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                dbData = userDoc.data();
                if (dbData.role === 'admin' || dbData.role === 'club') {
                    userRole = dbData.role;
                }
            }
        } catch (e) {
            console.log("Error fetching user role from db", e);
        }

        setRole(userRole);
        setUser(currentUser);
        setUserData(dbData); // Store profile data separately
      } else {
        setUser(null);
        setUserData(null);
        setRole('student');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

// Helper to interact with storage abstractly
const getItemAsync = async (key) => {
    if (Platform.OS === 'web') {
        const value = await AsyncStorage.getItem(key);
        return value;
    } else {
        return await SecureStore.getItemAsync(key);
    }
};

const setItemAsync = async (key, value) => {
    if (Platform.OS === 'web') {
        return await AsyncStorage.setItem(key, value);
    } else {
        return await SecureStore.setItemAsync(key, value);
    }
};

  const loadSavedAccounts = async () => {
      try {
          const json = await getItemAsync('saved_accounts');
          if (json) {
              setSavedAccounts(JSON.parse(json));
          }
      } catch (e) {
          console.log("Failed to load saved accounts", e);
      }
  };

  const saveAccountCredentials = async (user, password) => {
      try {
          // Get existing accounts
          let currentAccounts = [];
          const json = await getItemAsync('saved_accounts');
          if (json) currentAccounts = JSON.parse(json);

          // Update or Add
          const existingIndex = currentAccounts.findIndex(a => a.email === user.email);
          const newAccount = {
              email: user.email,
              password, // Storing password securely
              displayName: user.displayName || 'User',
              photoURL: user.photoURL,
              uid: user.uid
          };

          if (existingIndex >= 0) {
              currentAccounts[existingIndex] = newAccount;
          } else {
              currentAccounts.push(newAccount);
          }

          await setItemAsync('saved_accounts', JSON.stringify(currentAccounts));
          setSavedAccounts(currentAccounts);
      } catch (e) {
          console.log("Failed to save account", e);
      }
  };

  const switchAccount = async (targetEmail) => {
      // Use a separate flag for switching to prevent "flash" of Auth screen
      // We will handle this in the UI by keeping the current screen or showing a loader
      setLoading(true); 
      
      try {
          const account = savedAccounts.find(a => a.email === targetEmail);
          if (!account || !account.password) throw new Error("Account credentials not found");
          
          await firebaseSignOut(auth);
          await signInWithEmailAndPassword(auth, account.email, account.password);
          // Don't need to manually set user, onAuthStateChanged in useEffect will handle it
      } catch (e) {
          console.error("Switch failed", e);
          // If fail, ensure we stop loading so user isn't stuck
      } finally {
         setLoading(false);
      }
  };

  const removeSavedAccount = async (targetEmail) => {
      const newAccounts = savedAccounts.filter(a => a.email !== targetEmail);
      await setItemAsync('saved_accounts', JSON.stringify(newAccounts));
      setSavedAccounts(newAccounts);
  };

  // --- Auth Actions ---

  const signIn = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await saveAccountCredentials(result.user, password); // Auto-save
    return result;
  };

  const signUp = async (email, password, additionalData = {}) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const { user } = result;
    
    // Create user document
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      role: 'student', // Default role
      createdAt: new Date().toISOString(),
      ...additionalData
    });

    await saveAccountCredentials(user, password); // Auto-save
    return result;
  };

  const signOut = () => {
    return firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
        user, userData, role, loading, 
        signIn, signUp, signOut,
        savedAccounts, switchAccount, removeSavedAccount 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
