import { Image } from 'expo-image';
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  FlatList,
  Alert,
} from "react-native";
import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "react-native";


const { width } = Dimensions.get("window");
interface SavedRun {
  id: string;
  date: string;
  distance: number;
  duration: number;
  pace: string;
  calories?: number;
  notes?: string;
  locations?: any[];
}

export default function TabTwoScreen() {

   const [runs, setRuns] = useState<SavedRun[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [stats, setStats] = useState({
    totalDistance: 0,
    totalRuns: 0,
    avgPace: '0:00',
    bestPace: '0:00',
    longestRun: 0,
  });

  // Load runs from storage
  const loadRuns = async () => {
    try {
      const savedRuns = await AsyncStorage.getItem('runs');
      if (savedRuns) {
        const parsedRuns = JSON.parse(savedRuns);
        setRuns(parsedRuns);
        calculateStats(parsedRuns);
      }
    } catch (error) {
      console.error('Error loading runs:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRuns();
    }, [])
  );

  // Calculate statistics
  const calculateStats = (runsData: SavedRun[]) => {
    if (runsData.length === 0) return;

    const totalDist = runsData.reduce((sum, run) => sum + run.distance, 0);
    const totalDur = runsData.reduce((sum, run) => sum + run.duration, 0);
    const avgPace = calculateAvgPace(totalDist, totalDur);
    
    // Find best pace
    const paces = runsData.map(run => {
      const [mins, secs] = run.pace.split(':').map(Number);
      return mins * 60 + secs;
    });
    const bestPaceSecs = Math.min(...paces);
    const bestMins = Math.floor(bestPaceSecs / 60);
    const bestSecs = bestPaceSecs % 60;
    
    const longest = Math.max(...runsData.map(run => run.distance));

    setStats({
      totalDistance: totalDist,
      totalRuns: runsData.length,
      avgPace: avgPace,
      bestPace: `${bestMins}:${bestSecs.toString().padStart(2, '0')}`,
      longestRun: longest,
    });
  };

  const calculateAvgPace = (totalDist: number, totalDur: number): string => {
    if (totalDist === 0) return '0:00';
    const avgPaceMinPerKm = (totalDur / 60) / (totalDist / 1000);
    const mins = Math.floor(avgPaceMinPerKm);
    const secs = Math.round((avgPaceMinPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(2)}km`;
    }
  };

  const deleteRun = (runId: string) => {
    Alert.alert(
      "Delete Run",
      "Are you sure you want to delete this run?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const updatedRuns = runs.filter(run => run.id !== runId);
              await AsyncStorage.setItem('runs', JSON.stringify(updatedRuns));
              setRuns(updatedRuns);
              calculateStats(updatedRuns);
            } catch (error) {
              console.error('Error deleting run:', error);
            }
          }
        }
      ]
    );
  };

  const filterRunsByPeriod = (): SavedRun[] => {
    if (selectedPeriod === 'all') return runs;
    
    const now = new Date();
    const cutoff = new Date();
    
    if (selectedPeriod === 'week') {
      cutoff.setDate(now.getDate() - 7);
    } else if (selectedPeriod === 'month') {
      cutoff.setMonth(now.getMonth() - 1);
    }
    
    return runs.filter(run => new Date(run.date) >= cutoff);
  };

  const filteredRuns = filterRunsByPeriod();

  // Render each run item
  const renderRunItem = ({ item }: { item: SavedRun }) => (
    <TouchableOpacity 
      style={styles.runCard}
      onLongPress={() => deleteRun(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.runHeader}>
        <View style={styles.runDateContainer}>
          <Text style={styles.runDate}>{formatDate(item.date)}</Text>
          <Text style={styles.runTime}>
            {new Date(item.date).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
        <Icon name="dots-vertical" size={20} color="#95A5A6" />
      </View>

      <View style={styles.runStats}>
        <View style={styles.runStat}>
          <Icon name="map-marker-distance" size={16} color="#7F8C8D" />
          <Text style={styles.runStatValue}>{formatDistance(item.distance)}</Text>
        </View>

        <View style={styles.runStat}>
          <Icon name="clock-outline" size={16} color="#7F8C8D" />
          <Text style={styles.runStatValue}>{formatTime(item.duration)}</Text>
        </View>

        <View style={styles.runStat}>
          <Icon name="speedometer" size={16} color="#7F8C8D" />
          <Text style={styles.runStatValue}>{item.pace}/km</Text>
        </View>
      </View>

      {item.notes && (
        <Text style={styles.runNotes}>{item.notes}</Text>
      )}
    </TouchableOpacity>
  );
   return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Icon name="history" size={32} color="#2C3E50" />
        <Text style={styles.headerTitle}>history</Text>
        <TouchableOpacity
          onPress={loadRuns}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="refresh" size={24} color="#95A5A6" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Icon name="counter" size={20} color="#7F8C8D" />
          <Text style={styles.statValue}>{stats.totalRuns}</Text>
          <Text style={styles.statLabel}>total runs</Text>
        </View>

        <View style={styles.statCard}>
          <Icon name="map-marker-distance" size={20} color="#7F8C8D" />
          <Text style={styles.statValue}>{formatDistance(stats.totalDistance)}</Text>
          <Text style={styles.statLabel}>total dist</Text>
        </View>

        <View style={styles.statCard}>
          <Icon name="speedometer" size={20} color="#7F8C8D" />
          <Text style={styles.statValue}>{stats.avgPace}</Text>
          <Text style={styles.statLabel}>avg pace</Text>
        </View>

        <View style={styles.statCard}>
          <Icon name="trophy" size={20} color="#7F8C8D" />
          <Text style={styles.statValue}>{stats.bestPace}</Text>
          <Text style={styles.statLabel}>best pace</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, selectedPeriod === 'week' && styles.filterTabActive]}
          onPress={() => setSelectedPeriod('week')}
        >
          <Text style={[styles.filterText, selectedPeriod === 'week' && styles.filterTextActive]}>
            Week
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, selectedPeriod === 'month' && styles.filterTabActive]}
          onPress={() => setSelectedPeriod('month')}
        >
          <Text style={[styles.filterText, selectedPeriod === 'month' && styles.filterTextActive]}>
            Month
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, selectedPeriod === 'all' && styles.filterTabActive]}
          onPress={() => setSelectedPeriod('all')}
        >
          <Text style={[styles.filterText, selectedPeriod === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Runs List */}
      {filteredRuns.length > 0 ? (
        <FlatList
          data={filteredRuns}
          renderItem={renderRunItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>
              {filteredRuns.length} {filteredRuns.length === 1 ? 'run' : 'runs'} found
            </Text>
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="run-fast" size={64} color="#ECF0F1" />
          <Text style={styles.emptyText}>No runs yet</Text>
          <Text style={styles.emptySubtext}>
            Complete your first run to see it here
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 16 : 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ECF0F1",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "400",
    letterSpacing: 1,
    color: "#2C3E50",
    textTransform: "lowercase",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 16,
  },
  statCard: {
    width: (width - 48) / 2,
    backgroundColor: "#F8F9F9",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ECF0F1",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "300",
    color: "#2C3E50",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#95A5A6",
    textTransform: "lowercase",
    letterSpacing: 0.5,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterTabActive: {
    borderBottomColor: "#E74C3C",
  },
  filterText: {
    fontSize: 14,
    color: "#95A5A6",
    textTransform: "lowercase",
  },
  filterTextActive: {
    color: "#E74C3C",
    fontWeight: "500",
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 14,
    color: "#7F8C8D",
    marginBottom: 12,
    textTransform: "lowercase",
  },
  runCard: {
    backgroundColor: "#F8F9F9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ECF0F1",
  },
  runHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  runDateContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  runDate: {
    fontSize: 16,
    fontWeight: "500",
    color: "#2C3E50",
    marginRight: 8,
  },
  runTime: {
    fontSize: 14,
    color: "#95A5A6",
  },
  runStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  runStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  runStatValue: {
    fontSize: 14,
    color: "#2C3E50",
    marginLeft: 4,
  },
  runNotes: {
    fontSize: 13,
    color: "#7F8C8D",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ECF0F1",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#2C3E50",
    marginTop: 16,
    marginBottom: 8,
    textTransform: "lowercase",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#95A5A6",
    textAlign: "center",
    textTransform: "lowercase",
  },
});