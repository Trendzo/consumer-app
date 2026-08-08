// Trendzo wordmark — single white-on-transparent asset, tinted per surface.
// The source PNG is white, so `tint` must be set to C.ink on light
// backgrounds or the mark is invisible.

import React from 'react';
import { Image } from 'react-native';

const LOGO = require('../../assets/trendzo-logo.png');
// assets/trendzo-logo.png is 1200×189 — keep width derived so the mark never distorts.
const ASPECT = 1200 / 189;

// The new wordmark is much wider (6.35:1 vs the old 4.88:1), so heights run
// ~20% smaller than before for the same visual weight.
export function TrendzoLogo({ height = 16, tint = '#FFFFFF', style }: {
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
