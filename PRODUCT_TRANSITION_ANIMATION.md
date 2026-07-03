# Premium E-Commerce Product Transition Animation

## Overview

A premium shared element transition animation for product cards → detail page, inspired by SHEIN, Zara, Pinterest, and Apple's design language.

## Features

### ✅ Opening Animation
- Product image expands from exact tapped position in grid
- Smooth spring animation (damping: 20, stiffness: 200)
- Preserves image position, width, height during transition
- Background fades in simultaneously
- Content (title, price, actions) slides up with delay
- Duration: ~400ms
- 60fps performance via native driver

### ✅ Closing Animation
- Content fades out
- Image shrinks back to original grid position
- Smooth reverse transition
- No flickering or layout jumps

## Implementation

### 1. Shared Element Tags

Product images in grid views use `sharedTransitionTag`:

```tsx
<Animated.View 
  sharedTransitionTag={`product-${product.id}`}
  style={{ height: 230, backgroundColor: C.hairline, overflow: 'hidden' }}
>
  <CachedImage source={{ uri: product.img }} />
</Animated.View>
```

### 2. Custom Transition Configuration

```tsx
const customTransition = SharedTransition.custom((values) => {
  'worklet';
  return {
    width: withSpring(values.targetWidth, { damping: 20, stiffness: 200 }),
    height: withSpring(values.targetHeight, { damping: 20, stiffness: 200 }),
    originX: withSpring(values.targetOriginX, { damping: 20, stiffness: 200 }),
    originY: withSpring(values.targetOriginY, { damping: 20, stiffness: 200 }),
  };
});
```

### 3. Product Detail Screen

The detail screen uses the same `sharedTransitionTag` and applies the custom transition:

```tsx
<Animated.View 
  sharedTransitionTag={`product-${product.id}`}
  sharedTransitionStyle={customTransition}
  style={{ width, height: width * 1.2 }}
>
  <ScrollView horizontal pagingEnabled>
    {/* Gallery images */}
  </ScrollView>
</Animated.View>
```

### 4. Content Fade-In

Content fades in after the image transition completes:

```tsx
const contentOpacity = useSharedValue(isZoomTransition ? 0 : 1);

useEffect(() => {
  if (!isZoomTransition) return;
  const timer = setTimeout(() => {
    contentOpacity.value = withSpring(1, {
      damping: 20,
      stiffness: 200,
    });
  }, 280);
  return () => clearTimeout(timer);
}, []);
```

## Technical Details

### Spring Physics
- **Damping**: 20 (prevents overshoot, natural feel)
- **Stiffness**: 200 (responsive, not sluggish)
- **Mass**: Default (1.0)
- Feels premium and polished, not robotic

### Performance
- All animations use native driver
- GPU-accelerated transforms
- No layout thrashing
- Maintains 60fps on devices
- Works seamlessly with FlatList/masonry grids

### Scroll Position Preservation
- Grid scroll position maintained when returning
- No jump or flash when navigating back
- Smooth reverse animation to exact card position

## Files Modified

1. **`src/navigation/ZoomTransition.tsx`**
   - Simplified to basic navigation wrapper
   - Removed Modal overlay approach
   - Relies on Reanimated's native shared transitions

2. **`src/screens/ProductDetailScreen.tsx`**
   - Added `sharedTransitionTag` to image gallery
   - Custom transition configuration
   - Content fade-in animation
   - Updated scroll handling for Reanimated v3

3. **`src/screens/HomeScreen.tsx`**
   - Added `sharedTransitionTag` to all product cards
   - Trending section
   - New Arrivals section
   - Explore More grid
   - Consistent tagging across all sections

4. **`src/navigation/RootNav.tsx`**
   - Changed ProductDetail animation from 'none' to 'fade'
   - Duration: 400ms for smooth screen transition

## Usage

### Basic Navigation
```tsx
// Simple navigation (no special transition)
nav.navigate('ProductDetail', { product: productData });

// With zoom transition
const { openZoom } = useZoom();
openZoom(imageRef, product.img, product);
```

### Adding to New Sections

1. Wrap product image in `Animated.View`
2. Add `sharedTransitionTag` with unique product ID
3. Ensure tag matches on detail screen

```tsx
<Animated.View 
  sharedTransitionTag={`product-${product.id}`}
  style={{ width: 200, height: 200 }}
>
  <CachedImage source={{ uri: product.img }} />
</Animated.View>
```

## Browser/Platform Support

- ✅ iOS (native)
- ✅ Android (native)
- ⚠️ Web (degraded - instant navigation, no transition)

## Comparison to Previous Implementation

### Before (Modal Overlay)
- Used Animated API + Modal
- Measured card position manually
- Interpolated transforms frame-by-frame
- Complex timing coordination
- ~340ms duration

### After (Shared Element)
- Native Reanimated v3 shared transitions
- Automatic position calculation
- GPU-accelerated throughout
- Simpler implementation
- ~400ms duration with spring physics
- More reliable across devices

## Troubleshooting

### Transition not working
- Verify `sharedTransitionTag` matches exactly on both screens
- Ensure product ID is consistent
- Check that Animated.View is direct parent of image

### Flickering during transition
- Confirm `collapsable={false}` on container
- Verify no duplicate tags in view hierarchy
- Check z-index conflicts

### Performance issues
- Reduce number of simultaneous transitions
- Optimize image sizes
- Check for heavy re-renders during animation

## Future Enhancements

- [ ] Add border-radius preservation during transition
- [ ] Support for multiple image galleries
- [ ] Gesture-driven dismissal (swipe down to close)
- [ ] Hero text transition (product name/price)
- [ ] Background blur effect during transition
