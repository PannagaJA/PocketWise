import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { session, loading } = useAuth();

  // Keep a warm lavender-tinted background while auth initializes behind the splash overlay
  if (loading) {
    return <View style={styles.container} />;
  }

  // Smoothly redirect underneath the splash overlay
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8FD', // Warm near-white with subtle lavender tint
  },
});
