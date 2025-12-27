import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { cancelAllNotifications, testNotification } from '../lib/notificationService';
import { useTheme } from '../lib/ThemeContext';

// Helper for menu items
const MenuItem = ({ icon, label, onPress, theme, styles }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
        <Ionicons name={icon} size={22} color={theme.colors.text} />
        <Text style={styles.menuText}>{label}</Text>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
);

const BRANCHES = ['CSE', 'ETC','EE', 'ME', 'Civil'];

export default function ProfileScreen({ navigation }) {
  const { user, role, signOut, savedAccounts, switchAccount, removeSavedAccount } = useAuth();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  
  const [name, setName] = useState(user?.displayName || '');
  const [year, setYear] = useState('1');
  const [branch, setBranch] = useState('CSE');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.uid) fetchUserData();
  }, [user]);

  const fetchUserData = async () => {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.year) setYear(String(data.year)); 
            if (data.displayName) setName(data.displayName);
            if (data.branch) setBranch(data.branch);
        }
    } catch (e) {
        console.error(e);
    }
  };

  const handleSave = async () => {
      if (!name) return Alert.alert("Error", "Name cannot be empty");
      setLoading(true);
      try {
          await updateProfile(user, { displayName: name });
          
          let finalBranch = branch;
          if (role === 'admin') {
              finalBranch = 'All'; // Force 'All' for admins as requested
          }

          await updateDoc(doc(db, 'users', user.uid), {
              displayName: name,
              year: parseInt(year),
              branch: finalBranch
          });

          Alert.alert("Success", "Profile updated!");
          setIsEditing(false);
      } catch (error) {
          console.error(error);
          Alert.alert("Error", "Failed to update profile");
      } finally {
          setLoading(false);
      }
  };

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={{paddingBottom: 20}}>
          <View style={styles.header}>
            <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</Text>
            </View>
            {!isEditing ? (
                <>
                    <Text style={[theme.typography.h2, { color: theme.colors.text }]}>{name || 'User'}</Text>
                    <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{user?.email}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {year ? `Year ${year} • ` : ''}{role === 'admin' ? 'ADMIN' : (branch || 'Student')}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
                        <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                        <Text style={styles.editButtonText}>Edit Profile</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <View style={styles.editContainer}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput 
                        style={styles.input} 
                        value={name} 
                        onChangeText={setName} 
                        placeholder="Enter your name"
                        placeholderTextColor={theme.colors.textSecondary}
                    />

                    {role !== 'admin' && (
                        <>
                            <Text style={styles.label}>Year of Study</Text>
                            <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={String(year)}
                                        onValueChange={(itemValue) => setYear(itemValue)}
                                        dropdownIconColor={theme.colors.text}
                                        style={{color: theme.colors.text}}
                                        itemStyle={{color: theme.colors.text}}
                                    >
                                        <Picker.Item label="1st Year" value="1" />
                                        <Picker.Item label="2nd Year" value="2" />
                                        <Picker.Item label="3rd Year" value="3" />
                                        <Picker.Item label="4th Year" value="4" />
                                    </Picker>
                            </View>
                        </>
                    )}

                    {role !== 'admin' && (
                        <>
                            <Text style={styles.label}>Branch</Text>
                             <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={branch}
                                    onValueChange={(itemValue) => setBranch(itemValue)}
                                    dropdownIconColor={theme.colors.text}
                                    style={{color: theme.colors.text}}
                                    itemStyle={{color: theme.colors.text}}
                                >
                                    {BRANCHES.map(b => (
                                        <Picker.Item key={b} label={b} value={b} />
                                    ))}
                                </Picker>
                            </View>
                        </>
                    )}

                    <View style={styles.editActions}>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditing(false)}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            )}
          </View>
          
          {/* Menu Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Activity</Text>
            <MenuItem 
                icon="calendar-outline" 
                label="My Created Events" 
                onPress={() => navigation.navigate('Main', { screen: 'MyEventsTab' })} 
                theme={theme}
                styles={styles}
            />
            <MenuItem 
                icon="heart-outline" 
                label="Events I'm Going To" 
                onPress={() => Alert.alert("Coming Soon", "You can check specific events for now.")} 
                theme={theme}
                styles={styles}
            />
             <MenuItem 
                icon="notifications-outline" 
                label="Test Device Notification" 
                onPress={() => testNotification().then(() => Alert.alert("Sent", "Check your system tray!"))} 
                theme={theme}
                styles={styles}
            />
             <MenuItem 
                icon="trash-outline" 
                label="Clear All Notifications (Debug)" 
                onPress={() => {
                    Alert.alert("Confirm", "Clear all pending notifications?", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Clear", style: 'destructive', onPress: () => cancelAllNotifications().then(() => Alert.alert("Cleared", "All scheduled notifications removed.")) }
                    ]);
                }} 
                theme={theme}
                styles={styles}
            />
          </View>

          {/* Switch Accounts Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <View style={styles.menuItem}>
                <Ionicons name={isDarkMode ? "moon" : "sunny"} size={22} color={theme.colors.text} />
                <Text style={styles.menuText}>Dark Mode</Text>
                <Switch 
                    value={isDarkMode} 
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#767577', true: theme.colors.primary }}
                    thumbColor={isDarkMode ? '#fff' : '#f4f3f4'} 
                />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Switch Accounts</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountList}>
                {/* Current Account (Active) */}
                <View style={[styles.accountCard, styles.activeAccountCard]}>
                    <View style={styles.accountAvatarSmall}>
                        <Text style={styles.accountAvatarText}>
                            {name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.accountName} numberOfLines={1}>{name || 'User'}</Text>
                    <View style={styles.activeDot} />
                </View>

                {/* Saved Accounts */}
                {savedAccounts
                    .filter(acc => acc.email !== user?.email)
                    .map((acc, index) => (
                    <TouchableOpacity 
                        key={index} 
                        style={styles.accountCard}
                        onPress={() => switchAccount(acc.email)}
                        onLongPress={() => {
                            Alert.alert("Remove Account", `Remove ${acc.email} from saved accounts?`, [
                                { text: "Cancel", style: "cancel" },
                                { text: "Remove", style: "destructive", onPress: () => removeSavedAccount(acc.email) }
                            ])
                        }}
                    >
                        <View style={[styles.accountAvatarSmall, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
                             <Text style={[styles.accountAvatarText, { color: theme.colors.text }]}>
                                {acc.displayName?.[0]?.toUpperCase() || acc.email?.[0]?.toUpperCase()}
                            </Text>
                        </View>
                        <Text style={styles.accountName} numberOfLines={1}>{acc.displayName}</Text>
                    </TouchableOpacity>
                ))}

                {/* Add Account Button */}
                <TouchableOpacity 
                    style={[styles.accountCard, { borderStyle: 'dashed', borderWidth: 1, borderColor: theme.colors.textSecondary }]}
                    onPress={() => {
                        Alert.alert("Add Account", "You will be signed out to log in with a new account. Your current session is saved.", [
                            { text: "Cancel", style: "cancel" },
                            { text: "Continue", onPress: signOut }
                        ]);
                    }}
                >
                    <View style={[styles.accountAvatarSmall, { backgroundColor: 'transparent' }]}>
                        <Ionicons name="add" size={24} color={theme.colors.textSecondary} />
                    </View>
                    <Text style={styles.accountName}>Add</Text>
                </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
                <Text style={styles.logoutText}>Sign Out All Devices</Text>
            </TouchableOpacity>
          </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const getStyles = (theme) => StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  avatarText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  badge: {
    marginTop: theme.spacing.s,
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#000',
    fontWeight: 'bold',
  },
  editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.m,
      padding: 8,
  },
  editButtonText: {
      color: theme.colors.primary,
      fontWeight: '600',
      marginLeft: 4,
  },
  editContainer: {
      width: '100%',
      paddingHorizontal: theme.spacing.m,
      marginTop: theme.spacing.m,
  },
  label: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.colors.textSecondary,
      marginTop: 10,
      marginBottom: 5,
  },
  input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      fontSize: 16,
      color: theme.colors.text, 
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})
  },
  pickerContainer: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      marginBottom: 10,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden', // Fixes rounded corners on web
  },
  editActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 20,
  },
  cancelButton: {
      flex: 1,
      padding: 12,
      alignItems: 'center',
      borderRadius: 8,
      borderColor: theme.colors.border,
      borderWidth: 1,
  },
  saveButton: {
      flex: 1,
      padding: 12,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
  },
  cancelText: { color: theme.colors.text },
  saveText: { color: '#fff', fontWeight: 'bold' },

  section: {
    marginTop: theme.spacing.l,
    paddingHorizontal: theme.spacing.m, 
  },
  logoutButton: {
    marginTop: theme.spacing.m,
    padding: theme.spacing.m,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  logoutText: {
    color: theme.colors.error,
    fontWeight: 'bold',
  },
  sectionTitle: {
      ...theme.typography.h3,
      marginBottom: 10,
      color: theme.colors.textSecondary
  },
  menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 15,
  },
  menuText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
  },
  // Account Switching Styles
  accountList: {
      flexDirection: 'row',
      marginBottom: 10,
  },
  accountCard: {
      alignItems: 'center',
      marginRight: 15,
      width: 70,
  },
  activeAccountCard: {
      opacity: 1,
  },
  accountAvatarSmall: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 5,
  },
  accountAvatarText: {
      color: '#fff',
      fontSize: 20,
      fontWeight: 'bold',
  },
  accountName: {
      fontSize: 12,
      color: theme.colors.text,
      textAlign: 'center',
  },
  activeDot: {
      position: 'absolute',
      top: 0,
      right: 10,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#4CAF50',
      borderWidth: 2,
      borderColor: '#fff',
  }
});
