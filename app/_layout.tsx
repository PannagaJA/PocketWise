import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import '../global.css';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  );
}
