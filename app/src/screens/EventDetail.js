import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import * as CalendarService from '../lib/CalendarService';
import { db } from '../lib/firebaseConfig';
import { scheduleEventReminder } from '../lib/notificationService';
import { useTheme } from '../lib/ThemeContext';

export default function EventDetail({ route, navigation }) {
  const { eventId } = route.params;
  const { user, role } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState(null); // 'going', 'not_going'
  const [participantCount, setParticipantCount] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    // Real-time listener for event data (in case status changes)
    const unsubEvent = onSnapshot(doc(db, 'events', eventId), (doc) => {
        if (doc.exists()) {
            setEvent({ id: doc.id, ...doc.data() });
        } else {
            Alert.alert("Error", "Event not found");
            navigation.goBack();
        }
        setLoading(false);
    });

    // Real-time listener for participants
    const unsubParticipants = onSnapshot(collection(db, `events/${eventId}/participants`), (snapshot) => {
        setParticipantCount(snapshot.size);
        // Check my status
        const myDoc = snapshot.docs.find(d => d.id === user.uid);
        if (myDoc) setRsvpStatus('going');
        else setRsvpStatus(null);
    });

    return () => {
        unsubEvent();
        unsubParticipants();
    };
  }, [eventId, user.uid]);

  const toggleRsvp = async () => {
    if (!user) return;

    // --- PAID / EXTERNAL LINK CHECK ---
    if (rsvpStatus !== 'going') {
        if (event.isPaid) {
            if (event.registrationLink) {
                // Case 1: Paid & Has Link -> Confirm -> Open Link -> Ask to mark registered
                Alert.alert(
                    "Paid Event",
                    "This is a paid event. You will be redirected to the registration page.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { 
                            text: "Proceed to Register", 
                            onPress: () => {
                                openLink(event.registrationLink);
                                // Optional: Ask user if they completed it
                                setTimeout(() => {
                                    Alert.alert(
                                        "Did you register?",
                                        "Mark yourself as registered if you completed the process.",
                                        [
                                           { text: "No", style: "cancel" },
                                           { text: "Yes, I Registered", onPress: () => performRsvp() }
                                        ]
                                    )
                                }, 3000);
                            }
                        }
                    ]
                );
                return; // Stop here, wait for callback
            } else {
                // Case 2: Paid & No Link -> Block or Warning
                Alert.alert(
                    "Registration Pending",
                    "Registration for this paid event is not yet open on the app. Please contact the organizers."
                );
                return;
            }
        }
    }

    performRsvp();
  };

  const performRsvp = async () => {
    const ref = doc(db, 'events', eventId, 'participants', user.uid);
    const userRef = doc(db, 'users', user.uid, 'participating', eventId);

    try {
        if (rsvpStatus === 'going') {
            await deleteDoc(ref);
            await deleteDoc(userRef); // Remove from my list
            Alert.alert("Withdrawn", "You are no longer registered.");
        } else {
            // Fetch User Details for Analytics
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};

            const participantData = {
                userId: user.uid,
                email: user.email,
                name: user.displayName || 'Anonymous',
                branch: userData.branch || 'Unknown',
                year: userData.year || 'Unknown',
                joinedAt: new Date().toISOString()
            };

            await setDoc(ref, participantData);
            await setDoc(userRef, { eventId: eventId, joinedAt: new Date().toISOString() }); // Add to my list
            
            // Add to in-app notification center
            await addDoc(collection(db, 'users', user.uid, 'notifications'), {
                title: 'Event Registered',
                body: `You are going to ${event.title}`,
                read: false,
                createdAt: new Date().toISOString(),
                eventId: eventId
            });

            // Auto-schedule reminder on RSVP
            await scheduleEventReminder(event);
            Alert.alert("Success", "Registered for event! A reminder has been set for 10 mins before.");
        }
    } catch (e) {
        console.error(e);
        Alert.alert("Error", "Failed to update RSVP");
    }
  };

  // Google Calendar Integration
  const { request, response, promptAsync } = CalendarService.useCalendarAuth();

  useEffect(() => {
     if (response?.type === 'success') {
         const { access_token } = response.params;
         performAddToCalendar(access_token);
     }
  }, [response]);

  const performAddToCalendar = async (token) => {
      try {
          await CalendarService.addToCalendar(token, event);
          Alert.alert("Success", "Event added to your Google Calendar!");
      } catch (e) {
          Alert.alert("Error", "Failed to add to calendar.");
      }
  };

  const handleReminder = async () => {
      try {
          await setDoc(doc(db, 'reminders', `${user.uid}_${eventId}`), {
              userId: user.uid,
              eventId: eventId,
              remindAt: event.startAt // Simple logic: remind at start time
          });
          
           // Add to in-app notification center
          await addDoc(collection(db, 'users', user.uid, 'notifications'), {
                title: 'Reminder Set',
                body: `Reminder set for ${event.title}`,
                read: false,
                createdAt: new Date().toISOString(),
                eventId: eventId
          });

          await scheduleEventReminder(event);
          
          // Optionally prompt for Google Calendar sync too
          Alert.alert(
              "Reminder Set", 
              "You will be notified 10 minutes before. Add to Google Calendar as well?",
              [
                  { text: 'No, thanks' },
                  { text: 'Yes, Sync', onPress: () => promptAsync() }
              ]
          );

      } catch (e) {
          console.error(e);
          Alert.alert("Error", "Could not set reminder");
      }
  };

  // --- Moderation Actions ---
  const handleSuspend = async () => {
      try {
          await updateDoc(doc(db, 'events', eventId), { status: 'suspended' });
          Alert.alert("Suspended", "Event is now hidden from public feed.");
      } catch (e) { console.error(e) }
  };

  const handleAppeal = async () => {
      try {
          await updateDoc(doc(db, 'events', eventId), { appealStatus: 'pending' });
          Alert.alert("Appeal Sent", "Admin will review your request.");
      } catch (e) { console.error(e) }
  };

  const handleUnsuspend = async () => {
       try {
          await updateDoc(doc(db, 'events', eventId), { status: 'active', appealStatus: 'resolved' });
          Alert.alert("Restored", "Event is active again.");
      } catch (e) { console.error(e) }
  };

  const openLink = (url) => {
      if (url) Linking.openURL(url).catch(err => Alert.alert("Error", "Invalid URL"));
  };

  if (loading || !event) return <ActivityIndicator size="large" color={theme.colors.primary} style={{marginTop: 50}} />;

  const isOwner = event.ownerId === user.uid;
  const isAdmin = role === 'admin';
  const isSuspended = event.status === 'suspended';

  return (
    <ScreenWrapper>
      <ScrollView>
        {/* Banner - Click to Expand */}
        <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Image 
                source={{ uri: event.bannerUrl || 'https://via.placeholder.com/800x600' }} 
                style={styles.banner} 
                resizeMode="cover"
            />
        </TouchableOpacity>

        <View style={styles.container}>
            {/* Moderation Banner */}
            {isSuspended && (
                <View style={styles.warningBox}>
                    <Text style={styles.warningText}>⚠️ This event is SUSPENDED due to guidelines violation.</Text>
                    {isOwner && (
                        <TouchableOpacity onPress={handleAppeal} style={styles.appealBtn}>
                            <Text style={styles.appealText}>Raise Appeal</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <View style={styles.metaRow}>
                <View style={[styles.badge, { backgroundColor: theme.colors.secondary }]}>
                    <Text style={styles.badgeText}>{event.category}</Text>
                </View>
                {event.isPaid ? (
                    <View style={[styles.badge, { backgroundColor: '#ffe0b2' }]}>
                        <Text style={styles.badgeText}>Paid: ₹{event.price}</Text>
                    </View>
                ) : (
                    <View style={[styles.badge, { backgroundColor: '#c8e6c9' }]}>
                         <Text style={styles.badgeText}>Free</Text>
                    </View>
                )}
            </View>

            <Text style={styles.title}>{event.title}</Text>
            
            <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={20} color={theme.colors.textSecondary} />
                <Text style={styles.infoText}>{event.location}</Text>
            </View>
            <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color={theme.colors.textSecondary} />
                <Text style={styles.infoText}>
                    {new Date(event.startAt).toLocaleString()} 
                    {event.endAt ? ` - ${new Date(event.endAt).toLocaleTimeString()}` : ''}
                </Text>
            </View>

            {/* Target Audience */}
            <View style={styles.targetSection}>
                <Text style={styles.sectionHeader}>For:</Text>
                <Text style={styles.targetText}>
                    Dept: {event.target?.departments?.join(', ') || 'All'} • 
                    Years: {event.target?.years?.join(', ') || 'All'}
                </Text>
            </View>

            <Text style={styles.description}>{event.description}</Text>

            {/* Mode & Meet Link */}
            {event.eventMode === 'online' && (
                <View style={{marginBottom: 20}}>
                    <View style={styles.onlineBanner}>
                         <Ionicons name="videocam" size={20} color="#fff" />
                         <Text style={{color: '#fff', fontWeight: 'bold'}}>Online Event</Text>
                    </View>
                    
                    {/* Show Join Button if Owner or Registered */}
                    {(rsvpStatus === 'going' || isOwner) && event.meetLink ? (
                        <TouchableOpacity 
                            style={styles.joinBtn}
                            onPress={() => openLink(event.meetLink)}
                        >
                            <Ionicons name="logo-google" size={24} color="#fff" />
                            <Text style={styles.joinText}>Join Google Meet</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={{color: theme.colors.textSecondary, fontStyle: 'italic', marginTop: 5}}>
                            {rsvpStatus === 'going' ? 'Link will be shared shortly.' : 'Register to get the meeting link.'}
                        </Text>
                    )}
                </View>
            )}

            {/* Registration Link (External) */}
            {event.registrationLink && !event.isPaid ? (
                <TouchableOpacity onPress={() => openLink(event.registrationLink)} style={styles.linkBtn}>
                    <Text style={styles.linkText}>🌐 Open Registration Page</Text>
                </TouchableOpacity>
            ) : null}

            {/* Actions */}
            {!isSuspended && (
                <View style={styles.actionRow}>
                    <TouchableOpacity 
                        style={[styles.rsvpBtn, rsvpStatus === 'going' && styles.rsvpBtnActive]} 
                        onPress={toggleRsvp}
                    >
                        <Text style={[styles.rsvpText, rsvpStatus === 'going' && styles.rsvpTextActive]}>
                            {rsvpStatus === 'going' ? 'Registered' : 'RSVP Now'}
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.iconBtn} onPress={handleReminder}>
                        <Ionicons name="alarm-outline" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
            )}

            <Text style={styles.participants}>
                👥 {participantCount} people registered
            </Text>

            {/* Admin Controls */}
            {isAdmin && (
                <View style={[styles.adminPanel, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.adminHeader, { color: theme.colors.text }]}>Admin Controls</Text>
                    {isSuspended ? (
                        <TouchableOpacity style={styles.unsuspendBtn} onPress={handleUnsuspend}>
                            <Text style={styles.unsuspendText}>Un-suspend Event</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.suspendBtn} onPress={handleSuspend}>
                            <Text style={styles.suspendText}>Suspend Event</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
          <View style={styles.modalBg}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                  <Ionicons name="close-circle" size={40} color="#fff" />
              </TouchableOpacity>
              <Image 
                  source={{ uri: event?.bannerUrl || 'https://via.placeholder.com/800x600' }} 
                  style={styles.fullImage} 
                  resizeMode="contain"
              />
          </View>
      </Modal>
    </ScreenWrapper>
  );
}

const getStyles = (theme) => StyleSheet.create({
  banner: {
      width: '100%',
      height: 300, 
      backgroundColor: theme.colors.surface, // Dynamic background
  },
  container: {
      padding: theme.spacing.m,
  },
  warningBox: {
      backgroundColor: '#ffebee', // Red tint safe for now, or theme.colors.surface + border
      padding: 10,
      marginBottom: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.error,
  },
  warningText: {
      color: theme.colors.error,
      fontWeight: 'bold',
  },
  appealBtn: {
      marginTop: 5,
      alignSelf: 'flex-start',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.error,
  },
  appealText: {
      color: theme.colors.error,
      fontWeight: '600',
  },
  metaRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
  },
  badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
  },
  badgeText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#000',
  },
  title: {
      ...theme.typography.h2,
      marginBottom: 5,
      color: theme.colors.text, 
  },
  infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 5,
  },
  infoText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
  },
  targetSection: {
      marginTop: 5,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5
  },
  sectionHeader: { fontWeight: 'bold', color: theme.colors.text },
  targetText: { color: theme.colors.textSecondary },
  description: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.colors.text,
      marginVertical: 15,
  },
  linkBtn: {
      padding: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 20,
  },
  linkText: { color: theme.colors.primary, fontWeight: 'bold' },
  actionRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
  },
  rsvpBtn: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
  },
  rsvpBtnActive: {
      backgroundColor: theme.colors.success,
  },
  rsvpText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  rsvpTextActive: { color: '#fff' },
  iconBtn: {
      padding: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
  },
  participants: {
      marginTop: 15,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
  },
  adminPanel: {
      marginTop: 30,
      padding: 15,
      // backgroundColor removed here, applied inline dynamically
      borderRadius: 8,
  },
  adminHeader: { fontWeight: 'bold', marginBottom: 10 },
  suspendBtn: {
      backgroundColor: theme.colors.error,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
  },
  suspendText: { color: '#fff', fontWeight: 'bold' },
  unsuspendBtn: {
      backgroundColor: theme.colors.success,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
  },
  unsuspendText: { color: '#fff', fontWeight: 'bold' },
  modalBg: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
  },
  fullImage: {
      width: '100%',
      height: '80%',
  },
  closeBtn: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 10,
  },
  onlineBanner: {
      backgroundColor: theme.colors.primary,
      padding: 10,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
  },
  joinBtn: {
      backgroundColor: '#00796b', // Teal for Meet
      padding: 15,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      ...theme.shadows.default,
  },
  joinText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 18,
  }
});
