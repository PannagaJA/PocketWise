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

  // Filter transactions for selected account and parse timestamps
  const sortedTxs = useMemo(() => {
    const list = selectedAccountId && selectedAccountId !== 'all'
      ? transactions.filter((t) => t.account_id === selectedAccountId)
      : transactions;

    return list
      .map((t) => ({
        ...t,
        time: t.date ? new Date(t.date).getTime() : NaN,
      }))
      .filter((t) => !isNaN(t.time))
      .sort((a, b) => a.time - b.time);
  }, [transactions, selectedAccountId]);

  // Build Time Series Data Points STRICTLY BASED ON SPEND
  const chartPoints = useMemo(() => {
    const now = new Date();
    const nowTime = now.getTime();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    let rawPoints: {
      timestamp: number;
      dateLabel: string;
      subLabel: string;
      spent: number;
      deltaSpent: number;
      txCount: number;
    }[] = [];

    if (period === 'Day') {
      const startOfDay = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);
      const startOfDayTime = startOfDay.getTime();
      const endOfDayTime = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999).getTime();

      const todayExpenseTxs = sortedTxs.filter(
        (t) => t.type === 'expense' && t.time >= startOfDayTime && t.time <= endOfDayTime
      );

      let cumulativeSpent = 0;

      // Start of day baseline
      rawPoints.push({
        timestamp: startOfDayTime,
        dateLabel: `${startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, 12:00 AM`,
        subLabel: 'Start of Day',
        spent: 0,
        deltaSpent: 0,
        txCount: 0,
      });

      todayExpenseTxs.forEach((tx) => {
        cumulativeSpent += tx.amount_minor;
        rawPoints.push({
          timestamp: tx.time,
          dateLabel: formatDateTime(tx.date),
          subLabel: tx.description || 'Expense',
          spent: cumulativeSpent,
          deltaSpent: tx.amount_minor,
          txCount: 1,
        });
      });

      if (rawPoints[rawPoints.length - 1].timestamp < nowTime) {
        rawPoints.push({
          timestamp: nowTime,
          dateLabel: formatDateTime(now.toISOString()),
          subLabel: 'Now',
          spent: cumulativeSpent,
          deltaSpent: 0,
          txCount: todayExpenseTxs.length,
        });
      }

      if (todayExpenseTxs.length === 0) {
        rawPoints = [0, 6, 12, 18, now.getHours()].map((h) => {
          const ptDate = new Date(currentYear, currentMonth, currentDate, Math.min(h, now.getHours()), 0);
          return {
            timestamp: ptDate.getTime(),
            dateLabel: formatDateTime(ptDate.toISOString()),
            subLabel: 'No spending yet',
            spent: 0,
            deltaSpent: 0,
            txCount: 0,
          };
        });
      }
    } else if (period === 'Month') {
      const startOfMonthTime = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0).getTime();
      const monthExpenseTxs = sortedTxs.filter(
        (t) => t.type === 'expense' && t.time >= startOfMonthTime && t.time <= nowTime
      );

      const daysInMonthSoFar = currentDate;
      let cumulativeSpent = 0;
      let txIdx = 0;

      for (let day = 1; day <= daysInMonthSoFar; day++) {
        const dayStart = new Date(currentYear, currentMonth, day, 0, 0, 0, 0);
        const dayEnd = new Date(currentYear, currentMonth, day, 23, 59, 59, 999);
        const dayEndTime = dayEnd.getTime();

        let daySpent = 0;
        let dayTxCount = 0;

        while (txIdx < monthExpenseTxs.length && monthExpenseTxs[txIdx].time <= dayEndTime) {
          const tx = monthExpenseTxs[txIdx];
          daySpent += tx.amount_minor;
          dayTxCount++;
          txIdx++;
        }

        cumulativeSpent += daySpent;

        rawPoints.push({
          timestamp: dayEndTime,
          dateLabel: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          subLabel: dayTxCount > 0 ? `+${formatMoney(daySpent)} spent (${dayTxCount} tx)` : 'No expenses',
          spent: cumulativeSpent,
          deltaSpent: daySpent,
          txCount: dayTxCount,
        });
      }
    } else {
      // Year Period
      const startOfYearTime = new Date(currentYear, 0, 1, 0, 0, 0, 0).getTime();
      const yearExpenseTxs = sortedTxs.filter(
        (t) => t.type === 'expense' && t.time >= startOfYearTime && t.time <= nowTime
      );

      let cumulativeSpent = 0;
      let txIdx = 0;

      for (let m = 0; m <= currentMonth; m++) {
        const monthStart = new Date(currentYear, m, 1, 0, 0, 0, 0);
        const daysInM = new Date(currentYear, m + 1, 0).getDate();
        const monthEnd = new Date(currentYear, m, daysInM, 23, 59, 59, 999);
        const monthEndTime = monthEnd.getTime();

        let monthSpent = 0;
        let monthTxCount = 0;

        while (txIdx < yearExpenseTxs.length && yearExpenseTxs[txIdx].time <= monthEndTime) {
          const tx = yearExpenseTxs[txIdx];
          monthSpent += tx.amount_minor;
          monthTxCount++;
          txIdx++;
        }

        cumulativeSpent += monthSpent;
        const monthName = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        rawPoints.push({
          timestamp: monthEndTime,
          dateLabel: monthName,
          subLabel: monthTxCount > 0 ? `+${formatMoney(monthSpent)} (${monthTxCount} tx)` : 'No expenses',
          spent: cumulativeSpent,
          deltaSpent: monthSpent,
          txCount: monthTxCount,
        });
      }
    }

    const uniquePoints = rawPoints.filter((pt, idx, arr) => idx === 0 || pt.timestamp !== arr[idx - 1].timestamp);

    // Y-Axis Scaling: STRICTLY SCALED ON SPEND
    const spents = uniquePoints.map((p) => p.spent);
    let minS = Math.min(...spents);
    let maxS = Math.max(...spents);

    if (minS === maxS) {
      minS = 0;
      maxS = Math.max(1000, maxS);
    } else {
      // Give headroom at the top so the curve doesn't clip
      const diff = maxS - minS;
      minS = Math.max(0, minS - diff * 0.05);
      maxS += diff * 0.12;
    }

    const count = uniquePoints.length;
    const chartW = SVG_WIDTH - 2 * PADDING_X;
    const chartH = SVG_HEIGHT - 2 * PADDING_Y;

    return uniquePoints.map((pt, i) => {
      const x = count === 1 ? SVG_WIDTH / 2 : PADDING_X + (i / (count - 1)) * chartW;
      const sRatio = (pt.spent - minS) / (maxS - minS || 1);
      const y = PADDING_Y + chartH * (1 - sRatio);

      return {
        ...pt,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
      };
    });
  }, [period, sortedTxs]);

  // Total Spent in Selected Period
  const totalSpentPeriod = useMemo(() => {
    if (chartPoints.length === 0) return 0;
    return chartPoints[chartPoints.length - 1].spent;
  }, [chartPoints]);

  // Generate Smooth Cubic Bezier Curves for SPEND
  const svgPaths = useMemo(() => {
    if (chartPoints.length === 0) {
      return {
        line: `M 0 ${SVG_HEIGHT - PADDING_Y} L ${SVG_WIDTH} ${SVG_HEIGHT - PADDING_Y}`,
        area: `M 0 ${SVG_HEIGHT - PADDING_Y} L ${SVG_WIDTH} ${SVG_HEIGHT - PADDING_Y} L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z`,
      };
    }

    if (chartPoints.length === 1) {
      const y = chartPoints[0].y;
      return {
        line: `M 0 ${y} L ${SVG_WIDTH} ${y}`,
        area: `M 0 ${y} L ${SVG_WIDTH} ${y} L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z`,
      };
    }

    let d = `M ${chartPoints[0].x} ${chartPoints[0].y}`;

    for (let i = 0; i < chartPoints.length - 1; i++) {
      const p0 = chartPoints[i === 0 ? i : i - 1];
      const p1 = chartPoints[i];
      const p2 = chartPoints[i + 1];
      const p3 = chartPoints[i + 2 < chartPoints.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const lastX = chartPoints[chartPoints.length - 1].x;
    const areaD = `${d} L ${lastX} ${SVG_HEIGHT} L ${chartPoints[0].x} ${SVG_HEIGHT} Z`;

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

            {/* Sub-label during scrub (e.g. +₹450 on this day) */}
            {activeInterpolatedState && activeInterpolatedState.subLabel ? (
              <View className="bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">
                <Text className="text-[10px] font-bold text-rose-300">
                  {activeInterpolatedState.subLabel}
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
                y1={0}
                x2={activeInterpolatedState.x}
                y2={SVG_HEIGHT}
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
