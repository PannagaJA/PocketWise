import React, { useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Card } from './ui/Card';
import { formatMoney, formatDateTime } from '../lib/finance/core';
import { Transaction } from '../lib/services/transaction.service';
import { TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react-native';

export type TimePeriod = 'Day' | 'Month' | 'Year';

interface AccountItem {
  id: string;
  balance: number;
}

interface NetBalanceChartCardProps {
  accounts: AccountItem[];
  transactions: Transaction[];
  isLoading?: boolean;
}

const SVG_WIDTH = 340;
const SVG_HEIGHT = 100;
const PADDING_Y = 14;
const PADDING_X = 12;
const DWELL_HOLD_MS = 1000; // Hold readout for 1 second on touch release

export function NetBalanceChartCard({ accounts, transactions, isLoading }: NetBalanceChartCardProps) {
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

  // 1. Compute Current Total Net Balance
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  // 2. Build Time Series Data Points (Net Balance + Red Spent Graph)
  const chartPoints = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    let rawPoints: { timestamp: number; dateLabel: string; subLabel: string; balance: number; spent: number; delta: number }[] = [];

    // Clean and sort valid transactions chronologically
    const sortedTxs = [...transactions]
      .filter((t) => t.date && !isNaN(new Date(t.date).getTime()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (period === 'Day') {
      const startOfDay = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);
      const endOfDay = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999);

      const todayTxs = sortedTxs.filter((t) => {
        const d = new Date(t.date);
        return d >= startOfDay && d <= endOfDay;
      });

      const netToday = todayTxs.reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amount_minor;
        if (t.type === 'expense') return sum - t.amount_minor;
        return sum;
      }, 0);

      const startBalance = totalBalance - netToday;
      let runningBalance = startBalance;
      let runningSpent = 0;

      rawPoints.push({
        timestamp: startOfDay.getTime(),
        dateLabel: `${startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, 12:00 AM`,
        subLabel: 'Start of Day',
        balance: startBalance,
        spent: 0,
        delta: 0,
      });

      todayTxs.forEach((tx) => {
        const txTime = new Date(tx.date);
        const delta = tx.type === 'income' ? tx.amount_minor : tx.type === 'expense' ? -tx.amount_minor : 0;
        runningBalance += delta;
        if (tx.type === 'expense') {
          runningSpent += tx.amount_minor;
        }

        rawPoints.push({
          timestamp: txTime.getTime(),
          dateLabel: formatDateTime(tx.date),
          subLabel: tx.description || (tx.type === 'income' ? 'Income' : 'Expense'),
          balance: runningBalance,
          spent: runningSpent,
          delta,
        });
      });

      const nowTime = now.getTime();
      if (rawPoints[rawPoints.length - 1].timestamp < nowTime) {
        rawPoints.push({
          timestamp: nowTime,
          dateLabel: formatDateTime(now.toISOString()),
          subLabel: 'Current Balance',
          balance: totalBalance,
          spent: runningSpent,
          delta: 0,
        });
      }

      if (todayTxs.length === 0) {
        rawPoints = [0, 6, 12, 18, now.getHours()].map((h) => {
          const ptDate = new Date(currentYear, currentMonth, currentDate, Math.min(h, now.getHours()), 0);
          return {
            timestamp: ptDate.getTime(),
            dateLabel: formatDateTime(ptDate.toISOString()),
            subLabel: 'No activity',
            balance: totalBalance,
            spent: 0,
            delta: 0,
          };
        });
      }
    } else if (period === 'Month') {
      const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      const monthTxs = sortedTxs.filter((t) => new Date(t.date) >= startOfMonth && new Date(t.date) <= now);

      const netMonth = monthTxs.reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amount_minor;
        if (t.type === 'expense') return sum - t.amount_minor;
        return sum;
      }, 0);

      const startBalance = totalBalance - netMonth;
      const daysInMonthSoFar = currentDate;
      let cumulativeBalance = startBalance;
      let cumulativeSpent = 0;

      for (let day = 1; day <= daysInMonthSoFar; day++) {
        const dayStart = new Date(currentYear, currentMonth, day, 0, 0, 0, 0);
        const dayEnd = new Date(currentYear, currentMonth, day, 23, 59, 59, 999);

        const txsOnDay = sortedTxs.filter((t) => {
          const d = new Date(t.date);
          return d >= dayStart && d <= dayEnd;
        });

        const dayDelta = txsOnDay.reduce((sum, t) => {
          if (t.type === 'income') return sum + t.amount_minor;
          if (t.type === 'expense') return sum - t.amount_minor;
          return sum;
        }, 0);

        const daySpent = txsOnDay.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_minor, 0);

        cumulativeBalance += dayDelta;
        cumulativeSpent += daySpent;

        rawPoints.push({
          timestamp: dayEnd.getTime(),
          dateLabel: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          subLabel: txsOnDay.length > 0 ? `${txsOnDay.length} transaction${txsOnDay.length > 1 ? 's' : ''}` : 'No activity',
          balance: cumulativeBalance,
          spent: cumulativeSpent,
          delta: dayDelta,
        });
      }
    } else {
      const startOfYear = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      const yearTxs = sortedTxs.filter((t) => new Date(t.date) >= startOfYear && new Date(t.date) <= now);

      const netYear = yearTxs.reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amount_minor;
        if (t.type === 'expense') return sum - t.amount_minor;
        return sum;
      }, 0);

      const startBalance = totalBalance - netYear;
      let cumulativeBalance = startBalance;
      let cumulativeSpent = 0;

      for (let m = 0; m <= currentMonth; m++) {
        const monthStart = new Date(currentYear, m, 1, 0, 0, 0, 0);
        const daysInM = new Date(currentYear, m + 1, 0).getDate();
        const monthEnd = new Date(currentYear, m, daysInM, 23, 59, 59, 999);

        const txsInM = sortedTxs.filter((t) => {
          const d = new Date(t.date);
          return d >= monthStart && d <= monthEnd;
        });

        const monthDelta = txsInM.reduce((sum, t) => {
          if (t.type === 'income') return sum + t.amount_minor;
          if (t.type === 'expense') return sum - t.amount_minor;
          return sum;
        }, 0);

        const monthSpent = txsInM.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_minor, 0);

        cumulativeBalance += monthDelta;
        cumulativeSpent += monthSpent;

        const monthName = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        rawPoints.push({
          timestamp: monthEnd.getTime(),
          dateLabel: monthName,
          subLabel: txsInM.length > 0 ? `${txsInM.length} transactions` : 'No activity',
          balance: cumulativeBalance,
          spent: cumulativeSpent,
          delta: monthDelta,
        });
      }
    }

    const uniquePoints = rawPoints.filter((pt, idx, arr) => idx === 0 || pt.timestamp !== arr[idx - 1].timestamp);

    // Scaling for Net Balance Y
    const balances = uniquePoints.map((p) => p.balance);
    let minB = Math.min(...balances);
    let maxB = Math.max(...balances);

    if (minB === maxB) {
      const padding = Math.max(1000, Math.abs(minB) * 0.1);
      minB -= padding;
      maxB += padding;
    } else {
      const diff = maxB - minB;
      minB -= diff * 0.08;
      maxB += diff * 0.08;
    }

    // Scaling for Red Spent Y
    const spents = uniquePoints.map((p) => p.spent);
    let maxS = Math.max(...spents, 1000);

    const count = uniquePoints.length;
    const chartW = SVG_WIDTH - 2 * PADDING_X;
    const chartH = SVG_HEIGHT - 2 * PADDING_Y;

    return uniquePoints.map((pt, i) => {
      const x = count === 1 ? SVG_WIDTH / 2 : PADDING_X + (i / (count - 1)) * chartW;
      const bRatio = (pt.balance - minB) / (maxB - minB);
      const y = PADDING_Y + chartH * (1 - bRatio);

      const sRatio = pt.spent / maxS;
      const spentY = PADDING_Y + chartH * (1 - sRatio * 0.85); // scaled cleanly to stay bottom-aligned

      return {
        ...pt,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        spentY: Math.round(spentY * 100) / 100,
      };
    });
  }, [accounts, transactions, totalBalance, period]);

  // 3. Total Spent in Current Period
  const totalSpentPeriod = useMemo(() => {
    if (chartPoints.length === 0) return 0;
    return chartPoints[chartPoints.length - 1].spent;
  }, [chartPoints]);

  const periodChange = useMemo(() => {
    if (chartPoints.length < 2) return 0;
    const firstB = chartPoints[0].balance;
    const lastB = chartPoints[chartPoints.length - 1].balance;
    return lastB - firstB;
  }, [chartPoints]);

  const isPositive = periodChange >= 0 && totalBalance >= 0;
  const netStrokeColor = isPositive ? '#10B981' : '#EF4444'; // Emerald / Rose for Net Balance
  const spentStrokeColor = '#EF4444'; // Rose Red for Spent Graph

  // 4. Generate SVG Paths for BOTH Net Balance & Red Spent Graph
  const svgPaths = useMemo(() => {
    if (chartPoints.length === 0) {
      return {
        netLine: `M 0 50 L ${SVG_WIDTH} 50`,
        netArea: `M 0 50 L ${SVG_WIDTH} 50 L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z`,
        spentLine: `M 0 85 L ${SVG_WIDTH} 85`,
        spentArea: `M 0 85 L ${SVG_WIDTH} 85 L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z`,
      };
    }
    if (chartPoints.length === 1) {
      const y = chartPoints[0].y;
      const sY = chartPoints[0].spentY;
      return {
        netLine: `M 0 ${y} L ${SVG_WIDTH} ${y}`,
        netArea: `M 0 ${y} L ${SVG_WIDTH} ${y} L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z`,
        spentLine: `M 0 ${sY} L ${SVG_WIDTH} ${sY}`,
        spentArea: `M 0 ${sY} L ${SVG_WIDTH} ${sY} L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z`,
      };
    }

    // Cubic Bezier path for Net Balance
    let netD = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    let spentD = `M ${chartPoints[0].x} ${chartPoints[0].spentY}`;

    for (let i = 0; i < chartPoints.length - 1; i++) {
      const p0 = chartPoints[i === 0 ? i : i - 1];
      const p1 = chartPoints[i];
      const p2 = chartPoints[i + 1];
      const p3 = chartPoints[i + 2 < chartPoints.length ? i + 2 : i + 1];

      // Net Bezier
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      netD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;

      // Spent Bezier
      const scp1y = p1.spentY + (p2.spentY - p0.spentY) / 6;
      const scp2y = p2.spentY - (p3.spentY - p1.spentY) / 6;
      spentD += ` C ${cp1x.toFixed(1)} ${scp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${scp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.spentY.toFixed(1)}`;
    }

    const lastX = chartPoints[chartPoints.length - 1].x;
    const netAreaD = `${netD} L ${lastX} ${SVG_HEIGHT} L ${chartPoints[0].x} ${SVG_HEIGHT} Z`;
    const spentAreaD = `${spentD} L ${lastX} ${SVG_HEIGHT} L ${chartPoints[0].x} ${SVG_HEIGHT} Z`;

    return {
      netLine: netD,
      netArea: netAreaD,
      spentLine: spentD,
      spentArea: spentAreaD,
    };
  }, [chartPoints]);

  // 5. Magnetic Point Snapping + Sub-Pixel Interpolated Touch Calculation
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
        spentY: chartPoints[0].spentY,
        balance: chartPoints[0].balance,
        spent: chartPoints[0].spent,
        delta: chartPoints[0].delta,
        dateLabel: chartPoints[0].dateLabel,
        subLabel: chartPoints[0].subLabel,
        closestIdx: 0,
      };
    }

    const MAGNETIC_SNAP_RADIUS = 16;
    for (let idx = 0; idx < chartPoints.length; idx++) {
      const pt = chartPoints[idx];
      const dist = Math.abs(pt.x - targetX);
      const isKeyDiffPt = pt.delta !== 0 || idx === 0 || idx === chartPoints.length - 1;
      if (dist < (isKeyDiffPt ? MAGNETIC_SNAP_RADIUS : MAGNETIC_SNAP_RADIUS * 0.5)) {
        return {
          x: pt.x,
          y: pt.y,
          spentY: pt.spentY,
          balance: pt.balance,
          spent: pt.spent,
          delta: pt.delta,
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
    const interpSpentY = pA.spentY + t * (pB.spentY - pA.spentY);
    const interpBalance = Math.round(pA.balance + t * (pB.balance - pA.balance));
    const interpSpent = Math.round(pA.spent + t * (pB.spent - pA.spent));

    const closestIdx = t > 0.5 ? i + 1 : i;
    const closestNode = chartPoints[closestIdx] || pA;

    return {
      x: targetX,
      y: interpY,
      spentY: interpSpentY,
      balance: interpBalance,
      spent: interpSpent,
      delta: closestNode.delta,
      dateLabel: closestNode.dateLabel,
      subLabel: closestNode.subLabel,
      closestIdx,
    };
  }, [activeTouchPos, chartPoints]);

  if (activeInterpolatedState && activeInterpolatedState.closestIdx !== lastHapticIdxRef.current) {
    lastHapticIdxRef.current = activeInterpolatedState.closestIdx;
    try {
      Haptics.selectionAsync();
    } catch {}
  }

  // 6. Smooth Pan Gesture Handler with 1-second Dwell Hold on Touch Release
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
    <Card className="bg-zinc-900 border-zinc-800 p-6 mb-6 rounded-3xl overflow-hidden relative">
      {/* Header & Balance / Spent Display */}
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            {activeInterpolatedState ? activeInterpolatedState.dateLabel : 'Net Total Balance'}
          </Text>

          <View className="flex-row items-baseline gap-2 mt-1">
            <Text className="text-3xl font-extrabold text-white">
              {formatMoney(activeInterpolatedState ? activeInterpolatedState.balance : totalBalance)}
            </Text>
          </View>

          {/* Red Spent Readout indicator */}
          <View className="flex-row items-center gap-1.5 mt-1">
            <View className="w-2 h-2 rounded-full bg-rose-500" />
            <Text className="text-xs font-semibold text-rose-400">
              Spent {period}: {formatMoney(activeInterpolatedState ? activeInterpolatedState.spent : totalSpentPeriod)}
            </Text>
          </View>
        </View>

        {/* Change Indicator / Trend Pill */}
        <View
          className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 border ${
            (activeInterpolatedState ? activeInterpolatedState.delta >= 0 : isPositive)
              ? 'bg-emerald-500/20 border-emerald-500/30'
              : 'bg-rose-500/20 border-rose-500/30'
          }`}
        >
          {(activeInterpolatedState ? activeInterpolatedState.delta >= 0 : isPositive) ? (
            <TrendingUp size={13} color="#10B981" />
          ) : (
            <TrendingDown size={13} color="#EF4444" />
          )}
          <Text
            className={`text-xs font-extrabold ${
              (activeInterpolatedState ? activeInterpolatedState.delta >= 0 : isPositive) ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {activeInterpolatedState
              ? `${activeInterpolatedState.delta >= 0 ? '+' : ''}${formatMoney(activeInterpolatedState.delta)}`
              : `${periodChange >= 0 ? '+' : ''}${formatMoney(periodChange)}`}
          </Text>
        </View>
      </View>

      {/* Dynamic Interactive Dual SVG Curve (Net Balance + Red Spent Graph) */}
      <View
        className="my-2 h-28 w-full justify-center"
        onLayout={(e) => {
          chartLayoutWidthRef.current = e.nativeEvent.layout.width || SVG_WIDTH;
        }}
        {...panResponder.panHandlers}
      >
        <Svg height="100%" width="100%" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={netStrokeColor} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={netStrokeColor} stopOpacity="0.0" />
            </LinearGradient>
            <LinearGradient id="spentGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={spentStrokeColor} stopOpacity="0.25" />
              <Stop offset="100%" stopColor={spentStrokeColor} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Net Balance Area Fill & Line */}
          <Path d={svgPaths.netArea} fill="url(#balanceGradient)" />
          <Path d={svgPaths.netLine} fill="none" stroke={netStrokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Red Spent Graph Area Fill & Solid Line */}
          <Path d={svgPaths.spentArea} fill="url(#spentGradient)" />
          <Path d={svgPaths.spentLine} fill="none" stroke={spentStrokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Render visual node points for amount changes on Net Balance */}
          {chartPoints.map((pt, idx) => {
            const hasDiff = pt.delta !== 0;
            if (!hasDiff && idx !== 0 && idx !== chartPoints.length - 1) return null;
            return (
              <React.Fragment key={`pt-grp-${idx}`}>
                {/* Net Balance Node */}
                <Circle cx={pt.x} cy={pt.y} r={hasDiff ? 3.5 : 2} fill={hasDiff ? netStrokeColor : '#A1A1AA'} stroke="#18181B" strokeWidth="1" />
                {/* Spent Node */}
                {hasDiff && <Circle cx={pt.x} cy={pt.spentY} r="2.5" fill={spentStrokeColor} stroke="#18181B" strokeWidth="1" />}
              </React.Fragment>
            );
          })}

          {/* Touch Crosshair, Net Balance Ring, and Red Spent Point Indicator */}
          {activeInterpolatedState && (
            <>
              <Line
                x1={activeInterpolatedState.x}
                y1="0"
                x2={activeInterpolatedState.x}
                y2={SVG_HEIGHT}
                stroke="#A1A1AA"
                strokeWidth="1.5"
                strokeDasharray="4, 4"
              />
              {/* Net Balance Dot */}
              <Circle cx={activeInterpolatedState.x} cy={activeInterpolatedState.y} r="7" fill={netStrokeColor} opacity="0.35" />
              <Circle cx={activeInterpolatedState.x} cy={activeInterpolatedState.y} r="4" fill="#FFFFFF" stroke={netStrokeColor} strokeWidth="2.5" />

              {/* Red Spent Dot */}
              <Circle cx={activeInterpolatedState.x} cy={activeInterpolatedState.spentY} r="6" fill={spentStrokeColor} opacity="0.4" />
              <Circle cx={activeInterpolatedState.x} cy={activeInterpolatedState.spentY} r="3.5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
            </>
          )}
        </Svg>
      </View>

      {/* Time Period Selector & Legend Bar */}
      <View className="flex-row items-center justify-between pt-3 border-t border-zinc-800/80 mt-1">
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: netStrokeColor }} />
            <Text className="text-[11px] font-semibold text-zinc-400">Balance</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="w-2 h-2 rounded-full bg-rose-500" />
            <Text className="text-[11px] font-semibold text-rose-400">Spent</Text>
          </View>
        </View>

        <View className="flex-row bg-zinc-800/80 p-1 rounded-xl gap-1">
          {(['Day', 'Month', 'Year'] as TimePeriod[]).map((p) => {
            const isSelected = period === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => {
                  clearReleaseTimer();
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setPeriod(p);
                  setActiveTouchPos(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg ${isSelected ? 'bg-zinc-700' : 'bg-transparent'}`}
                activeOpacity={0.7}
              >
                <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-400'}`}>{p}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Card>
  );
}
