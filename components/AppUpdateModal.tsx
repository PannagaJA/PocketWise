import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { useUpdateStore } from '../lib/stores/updateStore';
import { Download, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react-native';

function formatBytes(bytes: number): string {
  if (bytes <= 0 || !bytes) return '104 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export const AppUpdateModal: React.FC = () => {
  const {
    updateInfo,
    status,
    progress,
    bytesWritten,
    totalBytes,
    errorMessage,
    modalVisible,
    closeModal,
    startDownload,
    installDownloadedApk,
  } = useUpdateStore();

  if (!updateInfo) {
    if (modalVisible) {
      return (
        <AppBottomSheet
          visible={modalVisible}
          onClose={closeModal}
          title="PocketWise Update"
          subtitle={status === 'error' ? 'Update check failed' : 'Checking for latest release...'}
          dismissOnBackdrop={true}
          contentContainerStyle={styles.container}
        >
          <View style={{ paddingVertical: 36, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' }}>
            {status === 'error' ? (
              <View style={{ alignItems: 'center' }}>
                <AlertCircle size={38} color="#EF4444" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937', marginTop: 12, textAlign: 'center' }}>
                  {errorMessage || 'Unable to fetch update details.'}
                </Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                  Please check your internet connection and try again.
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 14 }}>
                  Fetching latest update...
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                  Connecting to GitHub releases
                </Text>
              </View>
            )}
          </View>
        </AppBottomSheet>
      );
    }
    return null;
  }

  const isDownloading = status === 'downloading';
  const isDownloaded = status === 'downloaded';
  const isError = status === 'error';

  const percent = Math.round(progress * 100);
  const sizeText = formatBytes(totalBytes || updateInfo.apkSize || 104 * 1024 * 1024);
  const writtenText = formatBytes(bytesWritten);

  return (
    <AppBottomSheet
      visible={modalVisible}
      onClose={closeModal}
      title="App Update Available"
      subtitle="A newer version of PocketWise is ready"
      scrollable={true}
      dismissOnBackdrop={true}
      contentContainerStyle={styles.container}
    >
      <View style={styles.content}>
        {/* Version Difference Banner */}
        <View style={styles.versionCard}>
          <View style={styles.versionBadgesRow}>
            <View style={styles.currentBadge}>
              <Text style={styles.badgeLabel}>CURRENT</Text>
              <Text style={styles.currentVersionText}>v{updateInfo.currentVersion}</Text>
            </View>

            <View style={styles.arrowIconWrap}>
              <ArrowRight size={16} color="#6366F1" />
            </View>

            <View style={styles.latestBadge}>
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeLabelActive}>LATEST</Text>
              </View>
              <Text style={styles.latestVersionText}>v{updateInfo.version}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Release size: {sizeText}</Text>
            <View style={styles.securityBadge}>
              <ShieldCheck size={13} color="#10B981" />
              <Text style={styles.securityText}>Verified APK</Text>
            </View>
          </View>
        </View>

        {/* Error State */}
        {isError && !!errorMessage && (
          <View style={styles.errorBox}>
            <AlertCircle size={16} color="#DC2626" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Changelog / Release Notes */}
        <View style={styles.changelogSection}>
          <Text style={styles.sectionTitle}>What's New in v{updateInfo.version}:</Text>
          <View style={styles.changelogBox}>
            <ScrollView style={styles.changelogScroll} nestedScrollEnabled={true}>
              <Text style={styles.changelogText}>
                {updateInfo.changelog || '• General bug fixes and UI improvements\n• Stability and performance optimizations'}
              </Text>
            </ScrollView>
          </View>
        </View>

        {/* Download Progress Bar */}
        {isDownloading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressInfoRow}>
              <Text style={styles.progressLabel}>Downloading update APK...</Text>
              <Text style={styles.progressPercent}>{percent}%</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${Math.max(4, percent)}%` }]} />
            </View>
            <Text style={styles.progressSubtext}>
              {writtenText} of {sizeText}
            </Text>
          </View>
        )}

        {/* Downloaded State */}
        {isDownloaded && (
          <View style={styles.downloadedBanner}>
            <CheckCircle2 size={18} color="#10B981" />
            <Text style={styles.downloadedText}>
              Download complete! The Android installer is ready.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable onPress={closeModal} style={styles.laterButton}>
            <Text style={styles.laterButtonText}>
              {isDownloading ? 'Minimize' : 'Later'}
            </Text>
          </Pressable>

          {isDownloading ? (
            <View style={[styles.actionButton, styles.downloadingButton]}>
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>Downloading ({percent}%)...</Text>
            </View>
          ) : isDownloaded ? (
            <Pressable onPress={installDownloadedApk} style={[styles.actionButton, styles.installButton]}>
              <Download size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.actionButtonText}>Install Now</Text>
            </Pressable>
          ) : isError ? (
            <Pressable onPress={startDownload} style={[styles.actionButton, styles.retryButton]}>
              <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.actionButtonText}>Retry Download</Text>
            </Pressable>
          ) : (
            <Pressable onPress={startDownload} style={[styles.actionButton, styles.primaryButton]}>
              <Download size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.actionButtonText}>Update Now</Text>
            </Pressable>
          )}
        </View>
      </View>
    </AppBottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  content: {
    paddingHorizontal: 4,
  },
  versionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  versionBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  currentBadge: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  latestBadge: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
  },
  arrowIconWrap: {
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeLabelActive: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4338CA',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  currentVersionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  latestVersionText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4F46E5',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  changelogSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  changelogBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 140,
    padding: 12,
  },
  changelogScroll: {
    maxHeight: 116,
  },
  changelogText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: '#475569',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
  },
  progressContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  progressSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'right',
  },
  downloadedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  downloadedText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  laterButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  actionButton: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
  },
  downloadingButton: {
    backgroundColor: '#818CF8',
  },
  installButton: {
    backgroundColor: '#10B981',
  },
  retryButton: {
    backgroundColor: '#DC2626',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

