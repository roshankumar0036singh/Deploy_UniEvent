import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext'; // Import Theme

// Google Auth Imports
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig'; // Direct auth import for credential sign-in

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const { theme } = useTheme(); // Use Theme
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // For signup
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp } = useAuth();

  // Google Auth Setup
  const [request, response, promptAsync] = Google.useAuthRequest({
    // You MUST generate these in Google Cloud Console
    // And add them here or in .env
    // For Expo Go, we use the Web Client ID for all because of the Proxy
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    
    // On Web, use the current window location directly to avoid Proxy issues.
    // On Native, use ENV var or fallback to Expo Proxy auto-detection.
    // Simplified Redirect Logic for Web Focus
    redirectUri: Platform.OS === 'web' 
      ? (window.location.origin || process.env.EXPO_PUBLIC_REDIRECT_URI) 
      : (process.env.EXPO_PUBLIC_REDIRECT_URI || makeRedirectUri({ useProxy: true })),
  });

  // Removed Debug Alerts for cleaner UX ON LOCALHOST
  
  useEffect(() => {
     // 🔍 DEBUG: Show Redirect URI only on Mobile Web (Ngrok/LAN)
     if (Platform.OS === 'web' && window.location.hostname !== 'localhost' && request) {
         Alert.alert(
             "Mobile Web Debug", 
             `Generated Redirect URI:\n${request.redirectUri}\n\nPlease add EXACTLY this to Google Console.`
         );
     }
  }, [request]);
  useEffect(() => {
    if (response?.type === 'error') {
      Alert.alert('Auth Error', JSON.stringify(response.error || "Unknown Error", null, 2));
    } else if (response?.type === 'success') {
      const { id_token } = response.params;
      const { accessToken } = response.authentication || {};
      
      if (!id_token && !accessToken) {
          Alert.alert("Auth Error", "No tokens returned from Google");
          return;
      }

      const credential = GoogleAuthProvider.credential(id_token || null, accessToken || null);
      setLoading(true);
      signInWithCredential(auth, credential)
        .then(() => {
            // success, AuthContext will handle state change
        })
        .catch((error) => {
            Alert.alert("Google Sign-In Error", error.message);
        })
        .finally(() => setLoading(false));
    }
  }, [response]);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, { displayName: name });
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Styles
  const dynamicStyles = StyleSheet.create({
      container: {
          flex: 1,
          justifyContent: 'center',
          padding: 20,
          backgroundColor: theme.colors.background, // Dynamic
      },
      title: {
          fontSize: 28,
          fontWeight: 'bold',
          marginBottom: 30,
          textAlign: 'center',
          color: theme.colors.text, // Dynamic
      },
      input: {
          backgroundColor: theme.colors.surface, // Dynamic
          padding: 15,
          borderRadius: 10,
          marginBottom: 15,
          borderWidth: 1,
          borderColor: theme.colors.border,
          color: theme.colors.text, // Dynamic text
      },
      buttonText: {
          color: '#fff',
          fontSize: 16,
          fontWeight: 'bold',
      },
      switchText: {
          color: theme.colors.primary,
          fontSize: 14,
      },
      orText: {
          marginHorizontal: 10,
          color: theme.colors.textSecondary,
          fontWeight: 'bold'
      }
  });

  return (
    <View style={dynamicStyles.container}>
      <Text style={dynamicStyles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
      
      {!isLogin && (
        <TextInput
          style={dynamicStyles.input}
          placeholder="Full Name"
          placeholderTextColor={theme.colors.textSecondary}
          value={name}
          onChangeText={setName}
        />
      )}
      
      <TextInput
        style={dynamicStyles.input}
        placeholder="Email"
        placeholderTextColor={theme.colors.textSecondary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      <TextInput
        style={dynamicStyles.input}
        placeholder="Password"
        placeholderTextColor={theme.colors.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={dynamicStyles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
        )}
      </TouchableOpacity>

      {/* Google Sign In Button */}
      <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={dynamicStyles.orText}>OR</Text>
          <View style={styles.line} />
      </View>

      <TouchableOpacity 
        style={[styles.button, styles.googleBtn]} 
        onPress={() => {
          promptAsync().catch(err => {
             Alert.alert("Prompt Error", err.message);
          });
        }}
        disabled={!request || loading}
      >
          <Text style={[styles.buttonText, {color: '#333'}]}>
             {loading ? "Please wait..." : "Continue with Google"}
          </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchContainer}>
        <Text style={dynamicStyles.switchText}>
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  googleBtn: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ddd',
      marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 0,
  },
  line: {
      flex: 1,
      height: 1,
      backgroundColor: '#e0e0e0',
  }
});
