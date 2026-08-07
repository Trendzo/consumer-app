// Trendzo wordmark — single white-on-transparent asset, tinted per surface.
// The source PNG is white, so `tint` must be set to C.ink on light
// backgrounds or the mark is invisible.

import React from 'react';
import { Image } from 'react-native';

const LOGO = require('../../assets/trendzo-logo.png');
// assets/trendzo-logo.png is 600×123 — keep width derived so the mark never distorts.
const ASPECT = 600 / 123;

// Default bumped 16 → 20: at 13-16dp the wordmark was near-invisible in headers.
export function TrendzoLogo({ height = 20, tint = '#FFFFFF', style }: {
  height?: number;
  tint?: string;
  style?: object;
}) {
  return (
    <Image
      source={LOGO}
      style={[{ height, width: Math.round(height * ASPECT), tintColor: tint }, style]}
      resizeMode="contain"
    />
  );
}
