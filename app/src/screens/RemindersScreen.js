import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, getDocs, query, where, getDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { cancelScheduledNotification } from '../lib/notificationService';
import { useTheme } from '../lib/ThemeContext';

export default function RemindersScreen({ navigation }) {
    const { user } = useAuth();
    const { theme, isDarkMode } = useTheme();
    const styles = useMemo(() => getStyles(theme, isDarkMode), [theme, isDarkMode]);

    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (user) fetchReminders();
    }, [user]);

    const fetchReminders = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, 'reminders'),
                where('userId', '==', user.uid)
            );
            const snapshot = await getDocs(q);
            const list = [];

            // Parallel fetch for speed
            await Promise.all(snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                let eventTitle = 'Unknown Event';
                let eventLocation = '';
                let bannerUrl = null;
                try {
                    const eventDoc = await getDoc(doc(db, 'events', data.eventId));
                    if (eventDoc.exists()) {
                        const ed = eventDoc.data();
                        eventTitle = ed.title;
                        eventLocation = ed.location;
                        bannerUrl = ed.bannerUrl;
                    }
                } catch (e) { console.log(e) }

                list.push({ id: docSnap.id, eventTitle, eventLocation, bannerUrl, ...data });
            }));

            // Sort by remindAt
            list.sort((a, b) => {
                const da = a.remindAt?.toDate ? a.remindAt.toDate() : new Date(a.remindAt);
                const db = b.remindAt?.toDate ? b.remindAt.toDate() : new Date(b.remindAt);
                return da - db;
            });

            setReminders(list);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleDelete = async (item) => {
        Alert.alert("Remove Reminder", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove", style: "destructive", onPress: async () => {
                    try {
                        console.log("Deleting reminder:", item.id);
                        if (item.notificationId) {
                            console.log("Cancelling notification:", item.notificationId);
                            await cancelScheduledNotification(item.notificationId);
                        }
                        console.log("Deleting from Firestore...");
                        await deleteDoc(doc(db, 'reminders', item.id));
                        console.log("Updating local state...");
                        setReminders(prev => prev.filter(r => r.id !== item.id));
                        console.log("Reminder deleted successfully");
                    } catch (error) {
                        console.error("Delete error:", error);
                        Alert.alert("Error", `Could not delete reminder: ${error.message}`);
                    }
                }
            }
        ]);
    };

    const getRelativeTime = (dateStr) => {
        const date = dateStr?.toDate ? dateStr.toDate() : new Date(dateStr);
        const now = new Date();
        const diffMs = date - now;
        const diffMins = Math.round(diffMs / 60000);
        const diffHrs = Math.round(diffMs / 3600000);
        const diffDays = Math.round(diffMs / 86400000);

        if (diffMs < 0) return "Passed";
        if (diffMins < 60) return `${diffMins}m remaining`;
        if (diffHrs < 24) return `${diffHrs}h remaining`;
        return `${diffDays}d remaining`;
    };

    return (
        <ScreenWrapper>
            <View style={styles.headerContainer}>
                <Text style={styles.header}>My Reminders</Text>
                <TouchableOpacity onPress={fetchReminders} style={styles.refreshBtn}>
                    <Ionicons name="refresh" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={reminders}
                    keyExtractor={item => item.id}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReminders(); }} />}
                    renderItem={({ item }) => {
                        const dateObj = item.remindAt?.toDate ? item.remindAt.toDate() : new Date(item.remindAt);
                        return (
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() => navigation.navigate('EventDetail', { eventId: item.eventId })}
                            >
                                <Image
                                    source={{ uri: item.bannerUrl || 'https://via.placeholder.com/150' }}
                                    style={styles.cardImage}
                                />
                                <View style={styles.cardContent}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.eventTitle} numberOfLines={1}>{item.eventTitle}</Text>
                                        <TouchableOpacity onPress={() => handleDelete(item)}>
                                            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.row}>
                                        <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
                                        <Text style={styles.dateText}>
                                            {dateObj.toLocaleDateString()} • {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>

                                    <View style={styles.timerContainer}>
                                        <View style={styles.timerBadge}>
                                            <Ionicons name="alarm" size={12} color={theme.colors.primary} />
                                            <Text style={styles.timerText}>{getRelativeTime(item.remindAt)}</Text>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="notifications-off-outline" size={40} color={theme.colors.textSecondary} />
                            </View>
                            <Text style={styles.emptyText}>No reminders set</Text>
                            <Text style={styles.emptySubText}>Tap the bell icon on any event to get notified.</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 4 }}
                />
            )}
        </ScreenWrapper>
    );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
    headerContainer: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: theme.spacing.m, paddingHorizontal: theme.spacing.s,
    },
    header: { ...theme.typography.h2, color: theme.colors.text },
    refreshBtn: { padding: 8 },

    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        marginBottom: 16,
        flexDirection: 'row',
        ...theme.shadows.small,
        elevation: 2,
        padding: 12,
        alignItems: 'center',
        gap: 12
    },
    cardImage: {
        width: 80, height: 80, borderRadius: 12, backgroundColor: theme.colors.border
    },
    cardContent: { flex: 1, justifyContent: 'center' },
    cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4
    },
    eventTitle: {
        fontSize: 16, fontWeight: '700', color: theme.colors.text, flex: 1, marginRight: 8
    },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8
    },
    dateText: { color: theme.colors.textSecondary, fontSize: 13 },

    timerContainer: { flexDirection: 'row' },
    timerBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: isDarkMode ? 'rgba(var(--primary-rgb), 0.15)' : '#E3F2FD',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8
    },
    timerText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },

    emptyContainer: { alignItems: 'center', marginTop: 80 },
    emptyIconCircle: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.surface,
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        ...theme.shadows.small
    },
    emptyText: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },
    emptySubText: { color: theme.colors.textSecondary, marginTop: 8 }
});
