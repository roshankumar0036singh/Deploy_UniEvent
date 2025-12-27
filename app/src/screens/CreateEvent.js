import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../lib/AuthContext';
import * as CalendarService from '../lib/CalendarService';
import { db, storage } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

const DEFAULT_BANNERS = [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80', // Tech/Conference
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1000&q=80', // Party/Social
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1000&q=80', // Sports
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=80', // Friends/Group
];

const CATEGORIES = ['Tech', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'General'];
const BRANCHES = ['All', 'CSE', 'ETC', 'EE', 'ME', 'Civil'];
const YEARS = [1, 2, 3, 4];

export default function CreateEvent({ navigation }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);
    
    const [loading, setLoading] = useState(false);
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    
    // Selections
    const [category, setCategory] = useState('');
    const [targetBranches, setTargetBranches] = useState(['All']);
    const [targetYears, setTargetYears] = useState([]); 
    
    // Date Time State
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [dateMode, setDateMode] = useState('date');
    
    // --- NEW: Event Mode & Meet Integration ---
    const [eventMode, setEventMode] = useState('offline'); // 'offline' | 'online'
    const [meetLink, setMeetLink] = useState('');
    const [isPaid, setIsPaid] = useState(false);
    const [price, setPrice] = useState('');
    
    // Google Auth Hook
   // Google Auth Hook (unchanged)
const { request, response, promptAsync, getAccessToken } = CalendarService.useCalendarAuth();

useEffect(() => {
  if (response?.type === 'success') {
    getAccessToken().then(access_token => {
      if (access_token) {
        handleGenerateMeet(access_token);
      } else {
        Alert.alert("Authentication Error", "No access token received");
      }
    }).catch(err => {
      Alert.alert("Auth Error", "Failed to get access token: " + err.message);
    });
  }
}, [response]);

    const handleGenerateMeet = async (token) => {
        setLoading(true);
        try {
            const result = await CalendarService.createMeetEvent(token, {
                title: title || 'New Club Event',
                description: description || 'Created via Event App',
                startAt: startDate.toISOString(),
                endAt: endDate.toISOString()
            });
            
            if (result.meetLink) {
                setMeetLink(result.meetLink);
                setLocation('Google Meet'); // Auto-set location
                Alert.alert("Success", "Google Meet Link Generated!");
            } else {
                Alert.alert("Error", "Could not generate Meet link. Check permissions.");
            }
        } catch (e) {
            Alert.alert("Error", e.message);
        } finally {
            setLoading(false);
        }
    };
    // const [price, setPrice] = useState(''); // Removed duplicate
    
    const [registrationLink, setRegistrationLink] = useState('');
    const [imageUri, setImageUri] = useState(null); 

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri) => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const filename = `events/${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const storageRef = ref(storage, filename);
            await uploadBytes(storageRef, blob);
            return await getDownloadURL(storageRef);
        } catch (e) {
            console.error("Upload failed", e);
            throw e;
        }
    };

    const toggleBranch = (branch) => {
        if (branch === 'All') {
            setTargetBranches(['All']);
            return;
        }
        
        let newBranches = [...targetBranches];
        if (newBranches.includes('All')) newBranches = [];

        if (newBranches.includes(branch)) {
            newBranches = newBranches.filter(b => b !== branch);
        } else {
            newBranches.push(branch);
        }

        if (newBranches.length === 0) setTargetBranches(['All']);
        else setTargetBranches(newBranches);
    };

    const toggleYear = (y) => {
        if (targetYears.includes(y)) {
            setTargetYears(targetYears.filter(year => year !== y));
        } else {
            setTargetYears([...targetYears, y]);
        }
    };

    const onChangeStart = (event, selectedDate) => {
        const currentDate = selectedDate || startDate;
        setShowStartPicker(Platform.OS === 'ios');
        setStartDate(currentDate);
    };

    const onChangeEnd = (event, selectedDate) => {
        const currentDate = selectedDate || endDate;
        setShowEndPicker(Platform.OS === 'ios');
        setEndDate(currentDate);
    };

    const showDatepicker = (mode, isStart) => {
        setDateMode(mode);
        if (isStart) setShowStartPicker(true);
        else setShowEndPicker(true);
    };

    const handleCreate = async () => {
        if (!title || !description || !location || !category) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        setLoading(true);
        try {
            let finalBannerUrl = null;
            if (imageUri) {
                try {
                    finalBannerUrl = await uploadImage(imageUri);
                } catch (e) {
                    Alert.alert("Warning", "Image upload failed. Using default banner.");
                    finalBannerUrl = DEFAULT_BANNERS[Math.floor(Math.random() * DEFAULT_BANNERS.length)];
                }
            } else {
                finalBannerUrl = DEFAULT_BANNERS[Math.floor(Math.random() * DEFAULT_BANNERS.length)];
            }

            const eventData = {
                title,
                description,
                location,
                category,
                eventMode, // 'online' or 'offline'
                meetLink: eventMode === 'online' ? meetLink : null,
                startAt: startDate.toISOString(),
                endAt: endDate.toISOString(),
                isPaid,
                price: isPaid ? price : '0',
                registrationLink,
                target: {
                    departments: targetBranches,
                    years: targetYears.length > 0 ? targetYears : [1, 2, 3, 4]
                },
                bannerUrl: finalBannerUrl,
                ownerId: user.uid,
                ownerEmail: user.email,
                createdAt: new Date().toISOString(),
                status: 'active',
                appealStatus: null
            };

            await addDoc(collection(db, 'events'), eventData);
            Alert.alert('Success', 'Event created successfully!');
            navigation.goBack();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to create event');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.header}>Create Event</Text>
                
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.previewImage} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="image-outline" size={40} color={theme.colors.textSecondary} />
                            <Text style={{color: theme.colors.textSecondary}}>Tap to select Banner Image</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <Text style={styles.label}>Title <Text style={{color: 'red'}}>*</Text></Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Event Name" placeholderTextColor={theme.colors.textSecondary} />

                <Text style={styles.label}>Description <Text style={{color: 'red'}}>*</Text></Text>
                <TextInput 
                    style={[styles.input, { height: 100 }]} 
                    value={description} 
                    onChangeText={setDescription} 
                    placeholder="Event Details..." 
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline 
                />

                <Text style={styles.label}>Start Time</Text>
                {Platform.OS === 'web' ? (
                    <input 
                        type="datetime-local" 
                        value={new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)} 
                        onChange={(e) => setStartDate(new Date(e.target.value))}
                        style={{ padding: 10, fontSize: 16, borderRadius: 5, border: '1px solid #ccc', marginBottom: 10, display: 'block', width: '100%' }}
                    />
                ) : (
                    <>
                        <View style={styles.dateRow}>
                                <TouchableOpacity style={styles.dateBtn} onPress={() => showDatepicker('date', true)}>
                                    <Text style={{color: theme.colors.text}}>{startDate.toLocaleDateString()}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.dateBtn} onPress={() => showDatepicker('time', true)}>
                                    <Text style={{color: theme.colors.text}}>{startDate.toLocaleTimeString()}</Text>
                                </TouchableOpacity>
                        </View>
                        {showStartPicker && (
                            <DateTimePicker testID="dateTimePicker" value={startDate} mode={dateMode} is24Hour={true} display="default" onChange={onChangeStart} />
                        )}
                    </>
                )}

                <Text style={styles.label}>End Time</Text>
                {Platform.OS === 'web' ? (
                    <input 
                        type="datetime-local" 
                        value={new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)} 
                        onChange={(e) => setEndDate(new Date(e.target.value))}
                        style={{ padding: 10, fontSize: 16, borderRadius: 5, border: '1px solid #ccc', marginBottom: 10, display: 'block', width: '100%' }}
                    />
                ) : (
                    <>
                        <View style={styles.dateRow}>
                                <TouchableOpacity style={styles.dateBtn} onPress={() => showDatepicker('date', false)}>
                                    <Text style={{color: theme.colors.text}}>{endDate.toLocaleDateString()}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.dateBtn} onPress={() => showDatepicker('time', false)}>
                                    <Text style={{color: theme.colors.text}}>{endDate.toLocaleTimeString()}</Text>
                                </TouchableOpacity>
                        </View>
                            {showEndPicker && (
                            <DateTimePicker testID="dateTimePicker" value={endDate} mode={dateMode} is24Hour={true} display="default" onChange={onChangeEnd} />
                        )}
                    </>
                )}

                {/* --- EVENT MODE SECTION --- */}
                <Text style={styles.label}>Event Mode</Text>
                <View style={styles.row}>
                    <TouchableOpacity 
                        style={[styles.chip, eventMode === 'offline' && styles.chipActive]} 
                        onPress={() => setEventMode('offline')}
                    >
                        <Text style={[styles.chipText, eventMode === 'offline' && styles.chipTextActive]}>Offline (Venue)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.chip, eventMode === 'online' && styles.chipActive]} 
                        onPress={() => setEventMode('online')}
                    >
                        <Text style={[styles.chipText, eventMode === 'online' && styles.chipTextActive]}>Online (Google Meet)</Text>
                    </TouchableOpacity>
                </View>

                {eventMode === 'online' ? (
                     <View>
                        <Text style={styles.label}>Google Meet Link</Text>
                        <View style={styles.rowCenter}>
                            <TextInput 
                                style={[styles.input, {flex: 1, marginBottom: 0}]} 
                                value={meetLink} 
                                onChangeText={setMeetLink} 
                                placeholder="https://meet.google.com/..." 
                                placeholderTextColor={theme.colors.textSecondary}
                            />
                            <TouchableOpacity 
                                style={[styles.generateBtn, { borderColor: theme.colors.primary }]}
                                onPress={() => promptAsync()}
                                disabled={!request}
                            >
                                <Ionicons name="logo-google" size={20} color={theme.colors.primary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{fontSize: 12, color: theme.colors.textSecondary, marginBottom: 10}}>
                             Tap the Google icon to auto-generate a Meet link.
                        </Text>
                     </View>
                ) : (
                    <>
                        <Text style={styles.label}>Location <Text style={{color: 'red'}}>*</Text></Text>
                        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Venue" placeholderTextColor={theme.colors.textSecondary} />
                    </>
                )}

                {/* --- CATEGORY SECTION --- */}
                <Text style={styles.label}>Event Type (Category) <Text style={{color: 'red'}}>*</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                    {CATEGORIES.map(cat => (
                        <TouchableOpacity 
                            key={cat} 
                            style={[styles.chip, category === cat && styles.chipActive]}
                            onPress={() => setCategory(cat)}
                        >
                            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* --- BRANCH SECTION --- */}
                <Text style={styles.label}>Target Branch / Audience</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                    {BRANCHES.map(branch => (
                        <TouchableOpacity 
                            key={branch} 
                            style={[styles.chip, targetBranches.includes(branch) && styles.chipActive]}
                            onPress={() => toggleBranch(branch)}
                        >
                            <Text style={[styles.chipText, targetBranches.includes(branch) && styles.chipTextActive]}>{branch}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.rowCenter}>
                    <Text style={styles.label}>Paid Event?</Text>
                    <Switch value={isPaid} onValueChange={setIsPaid} />
                </View>
                {isPaid && (
                    <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="Price (₹)" keyboardType="numeric" placeholderTextColor={theme.colors.textSecondary}/>
                )}

                <Text style={styles.label}>Registration Link (Optional)</Text>
                <TextInput style={styles.input} value={registrationLink} onChangeText={setRegistrationLink} placeholder="https://..." placeholderTextColor={theme.colors.textSecondary}/>

                <Text style={styles.label}>Target Year (Leave empty for All)</Text>
                <View style={styles.row}>
                    {YEARS.map(y => (
                        <TouchableOpacity 
                            key={y} 
                            style={[styles.yearChip, targetYears.includes(y) && styles.yearChipActive]}
                            onPress={() => toggleYear(y)}
                        >
                            <Text style={[styles.yearText, targetYears.includes(y) && styles.yearTextActive]}>{y}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Post Event</Text>}
                </TouchableOpacity>
            </ScrollView>
        </ScreenWrapper>
    );
}

const getStyles = (theme) => StyleSheet.create({
    container: { padding: theme.spacing.m, paddingBottom: 50 },
    header: { ...theme.typography.h2, color: theme.colors.text, marginBottom: 15 },
    label: { fontWeight: 'bold', marginBottom: 5, marginTop: 10, color: theme.colors.text },
    input: {
        backgroundColor: theme.colors.surface,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 10,
        fontSize: 16,
        color: theme.colors.text, 
    },
    button: {
        backgroundColor: theme.colors.primary,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    chip: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginRight: 8,
        backgroundColor: theme.colors.surface,
    },
    chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    chipText: { color: theme.colors.text },
    chipTextActive: { color: '#fff', fontWeight: 'bold' },
    
    yearChip: {
        width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
    },
    yearChipActive: { backgroundColor: theme.colors.secondary, borderColor: theme.colors.secondary },
    yearText: { fontWeight: 'bold', color: theme.colors.text },
    yearTextActive: { color: '#000' },
    
    imagePicker: {
        height: 200,
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderStyle: 'dashed'
    },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { alignItems: 'center' },
    dateRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    dateBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        backgroundColor: theme.colors.surface
    },
    generateBtn: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginLeft: 10,
        backgroundColor: theme.colors.surface
    }
});
