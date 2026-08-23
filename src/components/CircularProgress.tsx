/**
 * CircularProgress — SVG-based circular progress ring.
 * Used in Network Quality score and Data Usage displays.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography } from '@/constants/theme';

interface CircularProgressProps {
  /** 0 – 100 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  /** Label shown inside the ring */
  label?: string;
  /** Sub-label shown below the value */
  subLabel?: string;
  /** Formatted value shown inside */
  displayValue?: string;
  /** MaterialIcon name to render in center instead of text */
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconSize?: number;
  iconColor?: string;
  children?: React.ReactNode;
}

export default function CircularProgress({
  progress,
  size = 80,
  strokeWidth = 6,
  color = Colors.tertiary,
  trackColor = Colors.surfaceContainerHigh,
  label,
  subLabel,
  displayValue,
  icon,
  iconSize,
  iconColor,
  children,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      {/* Center content */}
      <View style={styles.center}>
        {children ? (
          children
        ) : icon ? (
          <MaterialIcons
            name={icon}
            size={iconSize ?? 24}
            color={iconColor ?? color}
          />
        ) : (
          <>
            <Text style={[styles.value, { color: Colors.onSurface }]}>
              {displayValue ?? `${progress}`}
            </Text>
            {subLabel && <Text style={styles.subLabel}>{subLabel}</Text>}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
  },
  subLabel: {
    ...Typography.labelCaps,
    fontSize: 8,
    color: Colors.outline,
  },
});
