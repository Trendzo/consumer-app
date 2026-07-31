import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, T, SP, BORDER } from '../theme/brutal';
import { BrutalButton } from './Brutal';
import { useApp } from '../state/AppState';
import { addReview } from '../services/catalog';

/**
 * Write-a-review box for the PDP. Rendered ONLY for a signed-in shopper on a real
 * backend listing (the PDP gates it with `canReview`). The star rating is required;
 * the text body is optional.
 *
 * Verified-purchase is decided server-side from the shopper's orders — we never
 * send it. The response tells us whether the review is public (verified buyer) or
 * kept private to the author (non-buyer), and we message accordingly so a review
 * that won't appear to others doesn't just seem to vanish.
 */
export function ReviewComposer({
  listingId,
  onSubmitted,
}: {
  listingId: string;
  onSubmitted?: () => void;
}) {
  const { showToast } = useApp();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    try {
      const res = await addReview(listingId, { rating, body: body.trim() || undefined });
      setRating(0);
      setBody('');
      if (res.verifiedPurchase) {
        showToast('Review posted', 'Thanks — your verified review is now live.', 'check-circle');
      } else {
        // Non-buyers' reviews are recorded but never shown to other shoppers.
        showToast(
          'Review saved',
          'Only verified buyers appear publicly. Find yours in Profile › My Reviews.',
          'clock',
        );
      }
      onSubmitted?.();
    } catch {
      showToast('Could not post review', 'Please try again in a moment.', 'alert-circle');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[{ marginTop: SP.m, padding: SP.m }, BORDER(1)]}>
      <Text style={[T.caption, { color: C.ink }]}>Write a review</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: SP.s }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
            <Feather name="star" size={26} color={C.ink} style={{ opacity: n <= rating ? 1 : 0.25 }} />
          </Pressable>
        ))}
      </View>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Share what you liked (optional)"
        placeholderTextColor={C.dim}
        multiline
        maxLength={5000}
        style={[
          T.body,
          { color: C.ink, marginTop: SP.s, minHeight: 72, textAlignVertical: 'top', padding: SP.s },
          BORDER(1),
        ]}
      />
      <BrutalButton
        label={submitting ? 'Posting…' : 'Submit review'}
        icon="send"
        small
        disabled={rating < 1 || submitting}
        onPress={submit}
        style={{ marginTop: SP.s, alignSelf: 'flex-start' }}
      />
    </View>
  );
}
