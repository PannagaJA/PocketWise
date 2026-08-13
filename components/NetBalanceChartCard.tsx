import React, { useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Card } from './ui/Card';
import { formatMoney, formatDateTime } from '../lib/finance/core';
import { Transaction } from '../lib/services/transaction.service';
import { TrendingUp, TrendingDown } from 'lucide-react-native';

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

  // 2. Build Time Series Data Points based on Period & Transactions
  const chartPoints = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    let rawPoints: { timestamp: number; dateLabel: string; subLabel: string; balance: number; delta: number }[] = [];

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

      rawPoints.push({
        timestamp: startOfDay.getTime(),
        dateLabel: `${startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, 12:00 AM`,
        subLabel: 'Start of Day',
        balance: startBalance,
        delta: 0,
      });

      todayTxs.forEach((tx) => {
        const txTime = new Date(tx.date);
        const delta = tx.type === 'income' ? tx.amount_minor : tx.type === 'expense' ? -tx.amount_minor : 0;
        runningBalance += delta;

        rawPoints.push({
          timestamp: txTime.getTime(),
          dateLabel: formatDateTime(tx.date),
          subLabel: tx.description || (tx.type === 'income' ? 'Income' : 'Expense'),
          balance: runningBalance,
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

        cumulativeBalance += dayDelta;

        rawPoints.push({
          timestamp: dayEnd.getTime(),
          dateLabel: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          subLabel: txsOnDay.length > 0 ? `${txsOnDay.length} transaction${txsOnDay.length > 1 ? 's' : ''}` : 'No activity',
          balance: cumulativeBalance,
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

        cumulativeBalance += monthDelta;

        const monthName = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        rawPoints.push({
          timestamp: monthEnd.getTime(),
          dateLabel: monthName,
          subLabel: txsInM.length > 0 ? `${txsInM.length} transactions` : 'No activity',
          balance: cumulativeBalance,
          delta: monthDelta,
        });
      }
    }

    const uniquePoints = rawPoints.filter((pt, idx, arr) => idx === 0 || pt.timestamp !== arr[idx - 1].timestamp);

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

    const count = uniquePoints.length;
    const chartW = SVG_WIDTH - 2 * PADDING_X;
    const chartH = SVG_HEIGHT - 2 * PADDING_Y;

    return uniquePoints.map((pt, i) => {
      const x = count === 1 ? SVG_WIDTH / 2 : PADDING_X + (i / (count - 1)) * chartW;
      const ratio = (pt.balance - minB) / (maxB - minB);
      const y = PADDING_Y + chartH * (1 - ratio);
      return {
        ...pt,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
      };
    });
  }, [accounts, transactions, totalBalance, period]);

  // 3. Overall Period Trend & Color Scheme
  const periodChange = useMemo(() => {
    if (chartPoints.length < 2) return 0;
    const firstB = chartPoints[0].balance;
    const lastB = chartPoints[chartPoints.length - 1].balance;
    return lastB - firstB;
  }, [chartPoints]);

  const isPositive = periodChange >= 0 && totalBalance >= 0;
  const strokeColor = isPositive ? '#10B981' : '#EF4444';

  // 4. Smooth Cubic Bezier SVG Path
  const svgPaths = useMemo(() => {
    if (chartPoints.length === 0) {
      return { line: `M 0 50 L ${SVG_WIDTH} 50`, area: `M 0 50 L ${SVG_WIDTH} 50 L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z` };
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

    const areaD = `${d} L ${chartPoints[chartPoints.length - 1].x} ${SVG_HEIGHT} L ${chartPoints[0].x} ${SVG_HEIGHT} Z`;
    return { line: d, area: areaD };
  }, [chartPoints]);

  // 5. Magnetic Point Snapping + Sub-Pixel Interpolated Touch Calculation
  const activeInterpolatedState = useMemo(() => {
    if (activeTouchPos === null || chartPoints.length === 0) return null;

    const layoutW = chartLayoutWidthRef.current || SVG_WIDTH;
    const clampedPos = Math.max(0, Math.min(layoutW, activeTouchPos));
    const ratio = clampedPos / layoutW;
    const targetX = PADDING_X + ratio * (SVG_WIDTH - 2 * PADDING_X);

    // Single point edge case
    if (chartPoints.length === 1) {
      return {
        x: targetX,
        y: chartPoints[0].y,
        balance: chartPoints[0].balance,
        delta: chartPoints[0].delta,
        dateLabel: chartPoints[0].dateLabel,
        subLabel: chartPoints[0].subLabel,
        closestIdx: 0,
      };
    }

    // Magnetic snap radius to lock cleanly onto amount difference points
    const MAGNETIC_SNAP_RADIUS = 16;
    for (let idx = 0; idx < chartPoints.length; idx++) {
      const pt = chartPoints[idx];
      const dist = Math.abs(pt.x - targetX);
      const isKeyDiffPt = pt.delta !== 0 || idx === 0 || idx === chartPoints.length - 1;
      if (dist < (isKeyDiffPt ? MAGNETIC_SNAP_RADIUS : MAGNETIC_SNAP_RADIUS * 0.5)) {
        return {
          x: pt.x,
          y: pt.y,
          balance: pt.balance,
          delta: pt.delta,
          dateLabel: pt.dateLabel,
          subLabel: pt.subLabel,
          closestIdx: idx,
        };
      }
    }

    // Otherwise, smooth linear segment interpolation
    let i = 0;
    while (i < chartPoints.length - 2 && chartPoints[i + 1].x < targetX) {
      i++;
    }

    const pA = chartPoints[i];
    const pB = chartPoints[i + 1] || pA;

    const segmentW = Math.max(0.001, pB.x - pA.x);
    const t = Math.max(0, Math.min(1, (targetX - pA.x) / segmentW));

    const interpY = pA.y + t * (pB.y - pA.y);
    const interpBalance = Math.round(pA.balance + t * (pB.balance - pA.balance));

    const closestIdx = t > 0.5 ? i + 1 : i;
    const closestNode = chartPoints[closestIdx] || pA;

    return {
      x: targetX,
      y: interpY,
      balance: interpBalance,
      delta: closestNode.delta,
      dateLabel: closestNode.dateLabel,
      subLabel: closestNode.subLabel,
      closestIdx,
    };
  }, [activeTouchPos, chartPoints]);

  // Trigger light haptics only when snapping to new index during continuous slide
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
        // Hold/stay cleanly on selected point for 1 second (1000ms) before returning to total balance view
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
      {/* Header & Balance Display */}
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

      {/* Dynamic Interactive SVG Balance Curve */}
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
              <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Area Fill under curve */}
          <Path d={svgPaths.area} fill="url(#balanceGradient)" />

          {/* Curved Line */}
          <Path d={svgPaths.line} fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Render visual node points at positions where the amount differs / changes */}
          {chartPoints.map((pt, idx) => {
            const hasDiff = pt.delta !== 0;
            if (!hasDiff && idx !== 0 && idx !== chartPoints.length - 1) return null;
            return (
              <Circle
                key={`pt-dot-${idx}`}
                cx={pt.x}
                cy={pt.y}
                r={hasDiff ? 4 : 2.5}
                fill={hasDiff ? strokeColor : '#A1A1AA'}
                stroke="#18181B"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Continuous Interactive Touch Crosshair and Active Point Ring */}
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
              <Circle cx={activeInterpolatedState.x} cy={activeInterpolatedState.y} r="8" fill={strokeColor} opacity="0.35" />
              <Circle cx={activeInterpolatedState.x} cy={activeInterpolatedState.y} r="4.5" fill="#FFFFFF" stroke={strokeColor} strokeWidth="2.5" />
            </>
          )}
        </Svg>
      </View>

      {/* Time Period Selector Bar */}
      <View className="flex-row items-center justify-between pt-3 border-t border-zinc-800/80 mt-1">
        <Text className="text-[11px] font-semibold text-zinc-500">
          {activeInterpolatedState ? activeInterpolatedState.subLabel : `${chartPoints.length} datapoints`}
        </Text>

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
