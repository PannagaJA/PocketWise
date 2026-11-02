import React, { useState, useMemo, useRef, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Card } from './ui/Card';
import { formatMoney, formatDateTime } from '../lib/finance/core';
import { Transaction } from '../lib/services/transaction.service';
import { TrendingDown, TrendingUp, Wallet, Flame } from 'lucide-react-native';

export type TimePeriod = 'Day' | 'Month' | 'Year';

interface AccountItem {
  id: string;
  name?: string;
  balance: number;
}

export interface SpendChartCardProps {
  accounts: AccountItem[];
  transactions: Transaction[];
  selectedAccountId?: string;
  isLoading?: boolean;
}

const SVG_WIDTH = 340;
const SVG_HEIGHT = 110;
const PADDING_Y = 16;
const PADDING_X = 12;
const DWELL_HOLD_MS = 1200; // Hold readout for 1.2 seconds on touch release

export const SpendChartCard = memo(function SpendChartCard({
  accounts,
  transactions,
  selectedAccountId,
}: SpendChartCardProps) {
  const [period, setPeriod] = useState<TimePeriod>('Month');
  const [activeTouchPos, setActiveTouchPos] = useState<number | null>(null);
  const chartLayoutWidthRef = useRef<number>(SVG_WIDTH);
  const touchStartXRef = useRef<number>(0);
  const lastHapticIdxRef = useRef<number | null>(null);
  const releaseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearReleaseTimer = () => {
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  };

  // Selected Account resolution
  const selectedAccount = useMemo(() => {
    if (!selectedAccountId || selectedAccountId === 'all') return null;
    return accounts.find((a) => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  // Current Dashboard Balance (Selected Bank vs All Accounts Combined)
  const totalBalance = useMemo(() => {
    if (selectedAccount) {
      return selectedAccount.balance || 0;
    }
    return accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts, selectedAccount]);

  // Helper to parse date string into local date components safely without UTC timezone slip
  const parseTxDate = (dateStr?: string) => {
    if (!dateStr) return { year: 1970, month: 1, day: 1, str: '1970-01-01', time: 0 };
    const str = dateStr.substring(0, 10);
    const parts = str.split('-');
    const year = parseInt(parts[0], 10) || 1970;
    const month = parseInt(parts[1], 10) || 1;
    const day = parseInt(parts[2], 10) || 1;
    const time = new Date(year, month - 1, day, 12, 0, 0).getTime();
    return { year, month, day, str, time };
  };

  // Filter and sort expense transactions based on selected account
  const { sortedExpenseTxs, periodSummaryMeta } = useMemo(() => {
    const list = selectedAccountId && selectedAccountId !== 'all'
      ? transactions.filter((t) => t.account_id === selectedAccountId)
      : transactions;

    const expenses = list
      .filter((t) => t.type === 'expense')
      .map((t) => ({
        ...t,
        dateInfo: parseTxDate(t.date),
      }))
      .sort((a, b) => a.dateInfo.time - b.dateInfo.time || (a.id || '').localeCompare(b.id || ''));

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const thisMonthStr = todayStr.substring(0, 7);
    const thisYear = now.getFullYear();

    const latestTx = expenses[expenses.length - 1];

    let targetLabel = '';
    let targetTxCount = 0;
    let computedTotal = 0;

    if (period === 'Day') {
      const todayTxs = expenses.filter((t) => t.dateInfo.str === todayStr);
      const targetDayStr = todayTxs.length > 0 ? todayStr : (latestTx ? latestTx.dateInfo.str : todayStr);
      const targetTxs = expenses.filter((t) => t.dateInfo.str === targetDayStr);
      computedTotal = targetTxs.reduce((sum, t) => sum + t.amount_minor, 0);
      targetTxCount = targetTxs.length;

      const parts = targetDayStr.split('-');
      const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const dayName = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      targetLabel = targetDayStr === todayStr ? 'Today' : dayName;
    } else if (period === 'Month') {
      const thisMonthTxs = expenses.filter((t) => t.dateInfo.str.startsWith(thisMonthStr));
      const targetMonthStr = thisMonthTxs.length > 0 ? thisMonthStr : (latestTx ? latestTx.dateInfo.str.substring(0, 7) : thisMonthStr);
      const targetTxs = expenses.filter((t) => t.dateInfo.str.startsWith(targetMonthStr));
      computedTotal = targetTxs.reduce((sum, t) => sum + t.amount_minor, 0);
      targetTxCount = targetTxs.length;

      const parts = targetMonthStr.split('-');
      const mObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      targetLabel = mObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else {
      const thisYearTxs = expenses.filter((t) => t.dateInfo.year === thisYear);
      const targetYear = thisYearTxs.length > 0 ? thisYear : (latestTx ? latestTx.dateInfo.year : thisYear);
      const targetTxs = expenses.filter((t) => t.dateInfo.year === targetYear);
      computedTotal = targetTxs.reduce((sum, t) => sum + t.amount_minor, 0);
      targetTxCount = targetTxs.length;
      targetLabel = `${targetYear}`;
    }

    return {
      sortedExpenseTxs: expenses,
      periodSummaryMeta: {
        targetLabel,
        targetTxCount,
        computedTotal,
      },
    };
  }, [transactions, selectedAccountId, period]);

  // Build Time Series Data Points STRICTLY BASED ON PROPER SPEND
  const chartPoints = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const thisMonthStr = todayStr.substring(0, 7);
    const thisYear = now.getFullYear();

    const latestTx = sortedExpenseTxs[sortedExpenseTxs.length - 1];

    let points: {
      timestamp: number;
      dateLabel: string;
      subLabel: string;
      spent: number;
      deltaSpent: number;
      txCount: number;
    }[] = [];

    if (period === 'Day') {
      const todayTxs = sortedExpenseTxs.filter((t) => t.dateInfo.str === todayStr);
      const targetDayStr = todayTxs.length > 0 ? todayStr : (latestTx ? latestTx.dateInfo.str : todayStr);
      const targetTxs = sortedExpenseTxs.filter((t) => t.dateInfo.str === targetDayStr);

      const parts = targetDayStr.split('-');
      const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const dayLabel = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      points.push({
        timestamp: dObj.getTime(),
        dateLabel: `${dayLabel}, 12:00 AM`,
        subLabel: 'Start of Day',
        spent: 0,
        deltaSpent: 0,
        txCount: 0,
      });

      let running = 0;
      targetTxs.forEach((tx, idx) => {
        running += tx.amount_minor;
        points.push({
          timestamp: tx.dateInfo.time + idx + 1,
          dateLabel: `${dayLabel} (#${idx + 1})`,
          subLabel: `${tx.description || 'Expense'} (+${formatMoney(tx.amount_minor)})`,
          spent: running,
          deltaSpent: tx.amount_minor,
          txCount: 1,
        });
      });

      points.push({
        timestamp: dObj.getTime() + 86400000,
        dateLabel: `${dayLabel}, Total`,
        subLabel: `Day Total: ${formatMoney(running)}`,
        spent: running,
        deltaSpent: 0,
        txCount: targetTxs.length,
      });
    } else if (period === 'Month') {
      const thisMonthTxs = sortedExpenseTxs.filter((t) => t.dateInfo.str.startsWith(thisMonthStr));
      const targetMonthStr = thisMonthTxs.length > 0 ? thisMonthStr : (latestTx ? latestTx.dateInfo.str.substring(0, 7) : thisMonthStr);
      const targetTxs = sortedExpenseTxs.filter((t) => t.dateInfo.str.startsWith(targetMonthStr));

      const parts = targetMonthStr.split('-');
      const mObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      const mLabel = mObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      points.push({
        timestamp: mObj.getTime(),
        dateLabel: `${mLabel}, 1st`,
        subLabel: 'Start of Month',
        spent: 0,
        deltaSpent: 0,
        txCount: 0,
      });

      let running = 0;
      targetTxs.forEach((tx, idx) => {
        running += tx.amount_minor;
        const txDateObj = new Date(tx.dateInfo.year, tx.dateInfo.month - 1, tx.dateInfo.day);
        const txDayLabel = txDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        points.push({
          timestamp: tx.dateInfo.time + idx + 1,
          dateLabel: `${txDayLabel} (#${idx + 1})`,
          subLabel: `${tx.description || 'Expense'} (+${formatMoney(tx.amount_minor)})`,
          spent: running,
          deltaSpent: tx.amount_minor,
          txCount: 1,
        });
      });

      const daysInMonth = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
      const endMonthTime = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, daysInMonth, 23, 59, 59).getTime();

      points.push({
        timestamp: endMonthTime,
        dateLabel: `${mLabel}, Total`,
        subLabel: `Month Total: ${formatMoney(running)}`,
        spent: running,
        deltaSpent: 0,
        txCount: targetTxs.length,
      });
    } else {
      // Year Period
      const thisYearTxs = sortedExpenseTxs.filter((t) => t.dateInfo.year === thisYear);
      const targetYear = thisYearTxs.length > 0 ? thisYear : (latestTx ? latestTx.dateInfo.year : thisYear);
      const targetTxs = sortedExpenseTxs.filter((t) => t.dateInfo.year === targetYear);

      const yObj = new Date(targetYear, 0, 1);

      points.push({
        timestamp: yObj.getTime(),
        dateLabel: `${targetYear}, Jan 1`,
        subLabel: 'Start of Year',
        spent: 0,
        deltaSpent: 0,
        txCount: 0,
      });

      let running = 0;
      targetTxs.forEach((tx, idx) => {
        running += tx.amount_minor;
        const txDateObj = new Date(tx.dateInfo.year, tx.dateInfo.month - 1, tx.dateInfo.day);
        const txLabel = txDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        points.push({
          timestamp: tx.dateInfo.time + idx + 1,
          dateLabel: `${txLabel}`,
          subLabel: `${tx.description || 'Expense'} (+${formatMoney(tx.amount_minor)})`,
          spent: running,
          deltaSpent: tx.amount_minor,
          txCount: 1,
        });
      });

      const endYearTime = new Date(targetYear, 11, 31, 23, 59, 59).getTime();
      points.push({
        timestamp: endYearTime,
        dateLabel: `${targetYear}, Total`,
        subLabel: `Year Total: ${formatMoney(running)}`,
        spent: running,
        deltaSpent: 0,
        txCount: targetTxs.length,
      });
    }

    // Y-Axis Scaling: STRICTLY SCALED ON SPEND WITH ZERO BASELINE
    const spents = points.map((p) => p.spent);
    const maxSpent = Math.max(0, ...spents);
    const minS = 0;
    // Provide 15% headroom above the peak spend so the curve never clips the top
    const maxS = maxSpent > 0 ? maxSpent * 1.15 : 1000;

    const count = points.length;
    const chartW = SVG_WIDTH - 2 * PADDING_X;
    const chartH = SVG_HEIGHT - 2 * PADDING_Y;

    return points.map((pt, i) => {
      const x = count === 1 ? SVG_WIDTH / 2 : PADDING_X + (i / (count - 1)) * chartW;
      const sRatio = (pt.spent - minS) / (maxS - minS || 1);
      const y = PADDING_Y + chartH * (1 - sRatio);

      return {
        ...pt,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
      };
    });
  }, [period, sortedExpenseTxs]);

  // Total Spent in Selected Period
  const totalSpentPeriod = useMemo(() => {
    return periodSummaryMeta.computedTotal;
  }, [periodSummaryMeta]);

  // Generate Smooth Monotonic Cubic Bezier Curves for SPEND
  const svgPaths = useMemo(() => {
    const baselineY = SVG_HEIGHT - PADDING_Y;

    if (chartPoints.length === 0) {
      return {
        line: `M ${PADDING_X} ${baselineY} L ${SVG_WIDTH - PADDING_X} ${baselineY}`,
        area: `M ${PADDING_X} ${baselineY} L ${SVG_WIDTH - PADDING_X} ${baselineY} Z`,
      };
    }

    if (chartPoints.length === 1) {
      const y = chartPoints[0].y;
      return {
        line: `M ${PADDING_X} ${y} L ${SVG_WIDTH - PADDING_X} ${y}`,
        area: `M ${PADDING_X} ${y} L ${SVG_WIDTH - PADDING_X} ${y} L ${SVG_WIDTH - PADDING_X} ${baselineY} L ${PADDING_X} ${baselineY} Z`,
      };
    }

    let d = `M ${chartPoints[0].x} ${chartPoints[0].y}`;

    for (let i = 0; i < chartPoints.length - 1; i++) {
      const p0 = chartPoints[i === 0 ? i : i - 1];
      const p1 = chartPoints[i];
      const p2 = chartPoints[i + 1];
      const p3 = chartPoints[i + 2 < chartPoints.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      let cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      let cp2y = p2.y - (p3.y - p1.y) / 6;

      // Monotonic clamp to prevent overshooting beyond local extremes
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      cp1y = Math.max(minY, Math.min(maxY, cp1y));
      cp2y = Math.max(minY, Math.min(maxY, cp2y));

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const lastX = chartPoints[chartPoints.length - 1].x;
    const areaD = `${d} L ${lastX} ${baselineY} L ${chartPoints[0].x} ${baselineY} Z`;

    return {
      line: d,
      area: areaD,
    };
  }, [chartPoints]);

  // Magnetic Point Snapping + Sub-Pixel Interpolated Touch
  const activeInterpolatedState = useMemo(() => {
    if (activeTouchPos === null || chartPoints.length === 0) return null;

    const layoutW = chartLayoutWidthRef.current || SVG_WIDTH;
    const clampedPos = Math.max(0, Math.min(layoutW, activeTouchPos));
    const ratio = clampedPos / layoutW;
    const targetX = PADDING_X + ratio * (SVG_WIDTH - 2 * PADDING_X);

    if (chartPoints.length === 1) {
      return {
        x: targetX,
        y: chartPoints[0].y,
        spent: chartPoints[0].spent,
        deltaSpent: chartPoints[0].deltaSpent,
        dateLabel: chartPoints[0].dateLabel,
        subLabel: chartPoints[0].subLabel,
        closestIdx: 0,
      };
    }

    const MAGNETIC_SNAP_RADIUS = 18;
    for (let idx = 0; idx < chartPoints.length; idx++) {
      const pt = chartPoints[idx];
      const dist = Math.abs(pt.x - targetX);
      const isKeyPt = pt.deltaSpent > 0 || idx === 0 || idx === chartPoints.length - 1;
      if (dist < (isKeyPt ? MAGNETIC_SNAP_RADIUS : MAGNETIC_SNAP_RADIUS * 0.5)) {
        return {
          x: pt.x,
          y: pt.y,
          spent: pt.spent,
          deltaSpent: pt.deltaSpent,
          dateLabel: pt.dateLabel,
          subLabel: pt.subLabel,
          closestIdx: idx,
        };
      }
    }

    let i = 0;
    while (i < chartPoints.length - 2 && chartPoints[i + 1].x < targetX) {
      i++;
    }

    const pA = chartPoints[i];
    const pB = chartPoints[i + 1] || pA;

    const segmentW = Math.max(0.001, pB.x - pA.x);
    const t = Math.max(0, Math.min(1, (targetX - pA.x) / segmentW));

    const interpY = pA.y + t * (pB.y - pA.y);
    const interpSpent = Math.round(pA.spent + t * (pB.spent - pA.spent));

    const closestIdx = t > 0.5 ? i + 1 : i;
    const closestNode = chartPoints[closestIdx] || pA;

    return {
      x: targetX,
      y: interpY,
      spent: interpSpent,
      deltaSpent: closestNode.deltaSpent,
      dateLabel: closestNode.dateLabel,
      subLabel: closestNode.subLabel,
      closestIdx,
    };
  }, [activeTouchPos, chartPoints]);

  useEffect(() => {
    if (activeInterpolatedState && activeInterpolatedState.closestIdx !== lastHapticIdxRef.current) {
      lastHapticIdxRef.current = activeInterpolatedState.closestIdx;
      try {
        Haptics.selectionAsync();
      } catch {}
    }
  }, [activeInterpolatedState]);

  // Pan Responder for Touch Scrubber
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        clearReleaseTimer();
        touchStartXRef.current = evt.nativeEvent.locationX;
        setActiveTouchPos(touchStartXRef.current);
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        clearReleaseTimer();
        const currentX = touchStartXRef.current + gestureState.dx;
        setActiveTouchPos(currentX);
      },
      onPanResponderRelease: () => {
        clearReleaseTimer();
        releaseTimerRef.current = setTimeout(() => {
          setActiveTouchPos(null);
          lastHapticIdxRef.current = null;
        }, DWELL_HOLD_MS);
      },
      onPanResponderTerminate: () => {
        clearReleaseTimer();
        releaseTimerRef.current = setTimeout(() => {
          setActiveTouchPos(null);
          lastHapticIdxRef.current = null;
        }, DWELL_HOLD_MS);
      },
    })
  ).current;

  return (
    <Card className="bg-zinc-900 border-zinc-800 p-5 mb-5 rounded-3xl overflow-hidden relative shadow-sm">
      {/* Top Header: Readout on Left, Period Selector on Right */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 mr-2">
          {/* Label / Scrub Date */}
          <View className="flex-row items-center gap-1.5 mb-1">
            <View className="w-2 h-2 rounded-full bg-rose-500" />
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {activeInterpolatedState
                ? activeInterpolatedState.dateLabel
                : selectedAccount
                ? `${selectedAccount.name || 'Bank'} Spend`
                : `Total Spend (${period})`}
            </Text>
          </View>

          {/* Primary Big Metric: SPEND */}
          <Text className="text-3xl font-black text-white tracking-tight">
            {formatMoney(activeInterpolatedState ? activeInterpolatedState.spent : totalSpentPeriod)}
          </Text>

          {/* Subrow: Dashboard Balance Pill + Scrub Details */}
          <View className="flex-row items-center gap-2 mt-2 flex-wrap">
            {/* Dashboard Balance Pill */}
            <View className="flex-row items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-700/60">
              <Wallet size={11} color="#DDD6FE" />
              <Text className="text-[11px] font-bold text-zinc-300">
                Balance: {formatMoney(totalBalance)}
              </Text>
            </View>

            {/* Sub-label during scrub (e.g. +₹450 on this day) OR period summary context */}
            {activeInterpolatedState && activeInterpolatedState.subLabel ? (
              <View className="bg-rose-500/20 px-2.5 py-1 rounded-full border border-rose-500/30">
                <Text className="text-[10px] font-bold text-rose-300">
                  {activeInterpolatedState.subLabel}
                </Text>
              </View>
            ) : periodSummaryMeta.targetLabel ? (
              <View className="bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-700/60">
                <Text className="text-[11px] font-bold text-zinc-400">
                  {periodSummaryMeta.targetLabel} • {periodSummaryMeta.targetTxCount} {periodSummaryMeta.targetTxCount === 1 ? 'tx' : 'txs'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Time Period Selector: Day | Month | Year */}
        <View className="flex-row bg-zinc-800/90 p-1 rounded-2xl border border-zinc-700/60">
          {(['Day', 'Month', 'Year'] as TimePeriod[]).map((p) => {
            const isSelected = period === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setPeriod(p);
                  setActiveTouchPos(null);
                }}
                className={`px-2.5 py-1 rounded-xl ${
                  isSelected ? 'bg-violet-600 shadow-xs' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    isSelected ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SVG Interactive Spend Curve Area */}
      <View
        className="h-[110px] w-full justify-center relative mt-1"
        onLayout={(e) => {
          chartLayoutWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
          <Defs>
            {/* Rich Violet-to-Rose Gradient for the Spend Line */}
            <LinearGradient id="spendLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#8B5CF6" />
              <Stop offset="50%" stopColor="#EC4899" />
              <Stop offset="100%" stopColor="#F43F5E" />
            </LinearGradient>

            {/* Glowing Translucent Gradient Area Beneath Curve */}
            <LinearGradient id="spendAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#EC4899" stopOpacity="0.32" />
              <Stop offset="60%" stopColor="#8B5CF6" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Baseline Subtle Reference Grid Lines */}
          <Line
            x1={0}
            y1={SVG_HEIGHT - PADDING_Y}
            x2={SVG_WIDTH}
            y2={SVG_HEIGHT - PADDING_Y}
            stroke="#27272A"
            strokeWidth="1"
            strokeDasharray="4, 4"
          />
          <Line
            x1={0}
            y1={PADDING_Y}
            x2={SVG_WIDTH}
            y2={PADDING_Y}
            stroke="#27272A"
            strokeWidth="1"
            strokeDasharray="4, 4"
          />

          {/* Area Fill Under Spend Curve */}
          <Path d={svgPaths.area} fill="url(#spendAreaGrad)" />

          {/* Primary Spend Curve */}
          <Path
            d={svgPaths.line}
            stroke="url(#spendLineGrad)"
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Touch Scrubber Vertical Line & Magnetic Point */}
          {activeInterpolatedState && (
            <>
              <Line
                x1={activeInterpolatedState.x}
                y1={PADDING_Y}
                x2={activeInterpolatedState.x}
                y2={SVG_HEIGHT - PADDING_Y}
                stroke="#F43F5E"
                strokeWidth="1.5"
                strokeDasharray="3, 3"
              />
              <Circle
                cx={activeInterpolatedState.x}
                cy={activeInterpolatedState.y}
                r="7"
                fill="#F43F5E"
                opacity={0.3}
              />
              <Circle
                cx={activeInterpolatedState.x}
                cy={activeInterpolatedState.y}
                r="4.5"
                fill="#FFFFFF"
                stroke="#F43F5E"
                strokeWidth="2.5"
              />
            </>
          )}
        </Svg>
      </View>
    </Card>
  );
});

// Backwards-compatibility alias
export const NetBalanceChartCard = SpendChartCard;
