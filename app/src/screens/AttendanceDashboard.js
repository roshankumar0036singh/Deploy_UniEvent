import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, onSnapshot, orderBy, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

// Mock services if missing
const getAttendanceStats = async (eventId) => {
    // In a real app this would aggregate firestore data
    return { totalRegistrations: 0, totalCheckedIn: 0, checkInRate: 0, pending: 0 };
};


const { width } = Dimensions.get('window');

export default function AttendanceDashboard({ route, navigation }) {
    const { eventId, eventTitle } = route.params;
    const { user } = useAuth();
    const { theme } = useTheme();

    const [stats, setStats] = useState(null);
    const [checkIns, setCheckIns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [departmentStats, setDepartmentStats] = useState({});
    const [yearStats, setYearStats] = useState({});

    // Real-time stats listener
    useEffect(() => {
        const fetchStats = async () => {
            const statsData = await getAttendanceStats(eventId);
            setStats(statsData);
            setLoading(false);
        };

        fetchStats();
        // Poll every 10s for aggregate stats
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, [eventId]);

    // Real-time check-ins listener
    useEffect(() => {
        const q = query(
            collection(db, 'events', eventId, 'checkIns'),
            orderBy('checkedInAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const checkInsList = [];
            const deptCount = {};
            const yearCount = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                checkInsList.push({ id: doc.id, ...data });

                const dept = data.userBranch || 'Unknown';
                deptCount[dept] = (deptCount[dept] || 0) + 1;

                const year = data.userYear || 'Unknown';
                yearCount[year] = (yearCount[year] || 0) + 1;
            });

            setCheckIns(checkInsList);
            setDepartmentStats(deptCount);
            setYearStats(yearCount);
        });

        return () => unsubscribe();
    }, [eventId]);

    const downloadCSV = async (csvContent, fileName) => {
        if (Platform.OS === 'web') {
            // Create a blob and trigger download
            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
            const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // Use standard share on mobile
            await Share.share({ message: csvContent, title: fileName });
        }
    };

    const handleExportParticipants = async () => {
        setExporting(true);
        try {
            const participantsRef = collection(db, `events/${eventId}/participants`);
            const snapshot = await getDocs(participantsRef);

            if (snapshot.empty) {
                Alert.alert("No Data", "No registered participants yet.");
                setExporting(false);
                return;
            }

            let csv = "Name,Email,Branch,Year,Joined At\n";

            // Fetch live user profiles to fill in missing Branch/Year
            const rows = await Promise.all(snapshot.docs.map(async (docSnap) => {
                const d = docSnap.data();
                let branch = d.branch;
                let year = d.year;

                // If missing, try to fetch from User Profile
                if ((!branch || branch === '-' || branch === 'Unknown') && d.userId) {
                    try {
                        const { getDoc, doc } = require('firebase/firestore'); // Ensure imports
                        const userSnap = await getDoc(doc(db, 'users', d.userId));
                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            branch = userData.branch || branch;
                            year = userData.year || year;
                        }
                    } catch (e) { console.log("Profile fetch err", e); }
                }

                return `"${d.name || 'Anonymous'}","${d.email || '-'}","${branch || '-'}","${year || '-'}","${d.joinedAt}"\n`;
            }));

            csv += rows.join('');

            await downloadCSV(csv, `Participants_${eventTitle}.csv`);
            if (Platform.OS === 'web') Alert.alert("Success", "Download started!");

        } catch (error) {
            console.error("Export Error: ", error);
            Alert.alert("Error", "Failed to export participants.");
        } finally {
            setExporting(false);
        }
    };

    const handleExportReviews = async () => {
        setExporting(true);
        try {
            const feedbackRef = collection(db, `events/${eventId}/feedback`);
            const snapshot = await getDocs(feedbackRef);

            if (snapshot.empty) {
                Alert.alert("No Reviews", "This event has no feedback yet.");
                setExporting(false);
                return;
            }

            let csv = "User Name,Event Rating,Organizer Rating,Feedback,Date\n";
            snapshot.forEach(doc => {
                const d = doc.data();
                // Fix CSV escaping and formatting
                const safeFeedback = (d.feedback || '').replace(/"/g, '""');
                const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-';

                const line = `"${d.userName || 'Anonymous'}","${d.eventRating || '-'}","${d.clubRating || '-'}","${safeFeedback}","${dateStr}"\n`;
                csv += line;
            });

            await downloadCSV(csv, `Reviews_${eventTitle}.csv`);
            if (Platform.OS === 'web') Alert.alert("Success", "Download started!");

        } catch (error) {
            console.error("Export Error: ", error);
            Alert.alert("Error", "Failed to export reviews.");
        } finally {
            setExporting(false);
        }
    };

    const StatCard = ({ icon, label, value, color, subtitle, gradient }) => (
        <View style={styles.statCard}>
            <LinearGradient
                colors={gradient || [color + '20', color + '10']}
                style={styles.statGradient}
            >
                <View style={[styles.statIconBox, { backgroundColor: color + '30' }]}>
                    <Ionicons name={icon} size={22} color={color} />
                </View>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
                {subtitle && (
                    <Text style={[styles.statSubtitle, { color: theme.colors.textSecondary }]}>
                        {subtitle}
                    </Text>
                )}
            </LinearGradient>
        </View>
    );

    const CheckInItem = ({ item }) => {
        const timeAgo = getTimeAgo(item.checkedInAt?.toMillis());

        return (
            <View style={[styles.checkInItem, { backgroundColor: theme.colors.surface }]}>
                <View style={[styles.checkInAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                        {item.userName?.[0]?.toUpperCase() || '?'}
                    </Text>
                </View>
                <View style={styles.checkInInfo}>
                    <Text style={[styles.checkInName, { color: theme.colors.text }]}>
                        {item.userName}
                    </Text>
                    <View style={styles.checkInMeta}>
                        <Ionicons name="school-outline" size={12} color={theme.colors.textSecondary} />
                        <Text style={[styles.checkInDetails, { color: theme.colors.textSecondary }]}>
                            {item.userBranch} • Year {item.userYear}
                        </Text>
                    </View>
                </View>
                <View style={styles.checkInTime}>
                    <View style={styles.checkmarkBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                        {timeAgo}
                    </Text>
                </View>
            </View>
        );
    };

    const getTimeAgo = (timestamp) => {
        if (!timestamp) return 'Just now';
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes === 1) return '1 min ago';
        if (minutes < 60) return `${minutes} mins ago`;
        const hours = Math.floor(minutes / 60);
        if (hours === 1) return '1 hour ago';
        if (hours < 24) return `${hours} hours ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    const AnalyticsSection = ({ title, data, icon }) => {
        const total = Object.values(data).reduce((sum, val) => sum + val, 0);
        const sortedData = Object.entries(data).sort((a, b) => b[1] - a[1]);

        return (
            <View style={[styles.analyticsCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.analyticsHeader}>
                    <View style={styles.analyticsHeaderLeft}>
                        <Ionicons name={icon} size={18} color={theme.colors.primary} />
                        <Text style={[styles.analyticsTitle, { color: theme.colors.text }]}>{title}</Text>
                    </View>
                    <Text style={[styles.analyticsTotal, { color: theme.colors.textSecondary }]}>
                        {total} total
                    </Text>
                </View>
                {sortedData.map(([key, value]) => {
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return (
                        <View key={key} style={styles.analyticsItem}>
                            <View style={styles.analyticsItemHeader}>
                                <Text style={[styles.analyticsLabel, { color: theme.colors.text }]}>
                                    {key}
                                </Text>
                                <Text style={[styles.analyticsValue, { color: theme.colors.textSecondary }]}>
                                    {value} ({percentage}%)
                                </Text>
                            </View>
                            <View style={styles.analyticsBarBg}>
                                <LinearGradient
                                    colors={[theme.colors.primary, theme.colors.primary + '80']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[styles.analyticsBarFill, { width: `${percentage}%` }]}
                                />
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
            <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Attendance</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                        {eventTitle}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => navigation.navigate('QRScanner', { eventId, eventTitle })}
                    style={[styles.scanBtn, { backgroundColor: theme.colors.primary }]}
                >
                    <Ionicons name="qr-code" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.statsContainer}>
                    {/* Updated Stat Cards to use Primary Theme */}
                    <StatCard
                        icon="people"
                        label="REGISTERED"
                        value={stats?.totalRegistrations || 0}
                        color={theme.colors.primary}
                        gradient={[theme.colors.primary + '20', theme.colors.primary + '10']}
                    />
                    <StatCard
                        icon="checkmark-done-circle"
                        label="CHECKED IN"
                        value={stats?.totalCheckedIn || 0}
                        color="#ffffff" // White for contrast, or maybe lighter gold? No, user wants matching colour.
                        // Actually, let's use the primary color but maybe varying opacity or just consistent gold.
                        // If I use gold for both, it matches. Let's try that.
                        // Or maybe simple white/grey for the second one to keep it clean.
                        // Let's stick to Primary (Gold) for main, and maybe White for Checked In to differentiate? 
                        // User said "redesign ... in matching colour". Gold usually implies the main accent. 
                        // Let's use Gold for both but distinct icons.
                        // Or actually, let's use Gold for "Registered" and White text/icon for "Checked In" but with a Gold border?
                        // To be safe and "premium", let's use the Theme Primary for Registered and maybe a standard Text Color for Checked In but with Primary Icon.
                        // Wait, previous code had Blue and Green.
                        // I will set both to utilize the Primary color theme but maybe one is filled and one is outlined?
                        // For consistency, I will use Primary for both, or Primary and Secondary.
                        // Let's use theme.colors.primary for Registered, and maybe theme.colors.text (White) for Checked In, with Primary Icon.
                        gradient={[theme.colors.surface, theme.colors.surface]} // Just surface
                    />
                    {/* Re-doing the StatCards to be safe and consistent */}
                </View>
                {/* ... (rest of render is handled by partial replacement or I need to include it) */}
                {/* Wait, the replace_file_content needs to be precise. I will just replace the StatCards implementation in the render block */}


                {/* Live Check-Ins Feed */}
                <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionHeaderLeft}>
                            <View style={styles.liveDotContainer}>
                                <View style={styles.liveDot} />
                            </View>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                Live Check-Ins
                            </Text>
                        </View>
                        <View style={styles.countBadge}>
                            <Text style={[styles.countText, { color: theme.colors.primary }]}>
                                {checkIns.length}
                            </Text>
                        </View>
                    </View>
                    {checkIns.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.background }]}>
                                <Ionicons name="people-outline" size={40} color={theme.colors.textSecondary} />
                            </View>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                No check-ins yet
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.checkInsList}>
                            {checkIns.slice(0, 10).map((item) => (
                                <CheckInItem key={item.id} item={item} />
                            ))}
                        </View>
                    )}
                </View>

                {Object.keys(departmentStats).length > 0 && (
                    <AnalyticsSection
                        title="Department Breakdown"
                        data={departmentStats}
                        icon="school"
                    />
                )}

                {Object.keys(yearStats).length > 0 && (
                    <AnalyticsSection
                        title="Year-wise Distribution"
                        data={yearStats}
                        icon="calendar"
                    />
                )}

                <View style={styles.exportContainer}>
                    <Text style={[styles.exportTitle, { color: theme.colors.text }]}>Export Data</Text>
                    <View style={styles.exportButtons}>
                        <TouchableOpacity
                            style={[styles.exportBtn, styles.premiumBtn]}
                            onPress={handleExportParticipants}
                            disabled={exporting}
                        >
                            <Ionicons name="people" size={24} color={theme.colors.primary} />
                            <Text style={[styles.exportBtnText, { color: theme.colors.primary }]}>Participants</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.exportBtn, styles.premiumBtn]}
                            onPress={handleExportReviews}
                            disabled={exporting}
                        >
                            <Ionicons name="star" size={24} color={theme.colors.primary} />
                            <Text style={[styles.exportBtnText, { color: theme.colors.primary }]}>Reviews</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        elevation: 2,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 22, fontWeight: '800' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    scanBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsContainer: { flexDirection: 'row', padding: 16, gap: 10 },
    statCard: { flex: 1, borderRadius: 14, overflow: 'hidden', elevation: 2 },
    statGradient: { padding: 14, alignItems: 'center', gap: 6, minHeight: 130, justifyContent: 'center' },
    statIconBox: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    statValue: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
    statLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700', textAlign: 'center' },
    statSubtitle: { fontSize: 10, marginTop: 4, textAlign: 'center' },
    section: { margin: 16, marginTop: 0, borderRadius: 16, padding: 16 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    liveDotContainer: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF000020', alignItems: 'center', justifyContent: 'center' },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF0000' },
    sectionTitle: { fontSize: 17, fontWeight: '700' },
    countBadge: { backgroundColor: '#FF980020', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    countText: { fontSize: 14, fontWeight: '700' },
    checkInsList: { gap: 10 },
    checkInItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 12 },
    checkInAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '700' },
    checkInInfo: { flex: 1, gap: 4 },
    checkInName: { fontSize: 15, fontWeight: '600' },
    checkInMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    checkInDetails: { fontSize: 12 },
    checkInTime: { alignItems: 'flex-end', gap: 6 },
    checkmarkBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#4CAF5020', alignItems: 'center', justifyContent: 'center' },
    timeText: { fontSize: 11 },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyText: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
    analyticsCard: { margin: 16, marginTop: 0, padding: 16, borderRadius: 16 },
    analyticsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    analyticsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    analyticsTitle: { fontSize: 17, fontWeight: '700' },
    analyticsTotal: { fontSize: 12, fontWeight: '600' },
    analyticsItem: { marginBottom: 14 },
    analyticsItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    analyticsLabel: { fontSize: 14, fontWeight: '600' },
    analyticsValue: { fontSize: 13 },
    analyticsBarBg: { height: 8, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' },
    analyticsBarFill: { height: '100%', borderRadius: 4 },
    exportContainer: { margin: 16, marginTop: 0 },
    exportTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
    exportButtons: { flexDirection: 'row', gap: 12 },
    exportBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
    premiumBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16,
        borderWidth: 1, borderColor: '#FFD700', borderRadius: 14 // Gold border
    },
    exportBtnText: { fontSize: 14, fontWeight: '700' },
});
