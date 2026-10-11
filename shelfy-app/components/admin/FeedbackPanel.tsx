import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { FeedbackRecord, FeedbackStatus } from '@/lib/firestore';
import { createAdminStyles } from './adminStyles';
import { Chip } from './AdminUi';
import { fbLabel, fbStatusLabel, fbStatusStyle, fbTagStyle, formatDate } from './adminUtils';
import type { AdminData } from './useAdminData';

type FeedbackFilter = 'all' | FeedbackStatus;

/** `columns` > 1 dispone le schede in griglia (desktop). */
export function FeedbackPanel({ data, columns = 1 }: { data: AdminData; columns?: number }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createAdminStyles);
  const [filter, setFilter] = useState<FeedbackFilter>('nuovo');

  const visible = useMemo(
    () => (filter === 'all' ? data.feedback : data.feedback.filter((f) => f.status === filter)),
    [data.feedback, filter],
  );

  const chips: { id: FeedbackFilter; label: string }[] = [
    { id: 'nuovo', label: `${t('admin.feedbackFilters.new')} · ${data.counts.newFeedback}` },
    { id: 'letto', label: t('admin.feedbackFilters.read') },
    { id: 'risolto', label: t('admin.feedbackFilters.resolved') },
    { id: 'all', label: t('admin.feedbackFilters.all') },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.chipsRow}>
        {chips.map((c) => <Chip key={c.id} label={c.label} active={filter === c.id} onPress={() => setFilter(c.id)} />)}
      </View>

      {visible.length === 0 ? <Text style={styles.empty}>{t('admin.noFeedback')}</Text> : (
        <View style={columns > 1 ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : { gap: 12 }}>
          {visible.map((f) => (
            <View key={f.id} style={columns > 1 ? { width: `${100 / columns - 2}%`, minWidth: 280, flexGrow: 1 } : undefined}>
              <FeedbackCard f={f} data={data} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function FeedbackCard({ f, data }: { f: FeedbackRecord; data: AdminData }) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useThemedStyles(createAdminStyles);

  return (
    <View style={styles.card}>
      <View style={styles.fbHeader}>
        <View style={styles.fbTags}>
          <View style={[styles.fbTag, fbTagStyle(f.category)]}>
            <Text style={styles.fbTagText}>{fbLabel(f.category)}</Text>
          </View>
          <View style={[styles.fbTag, fbStatusStyle(f.status)]}>
            <Text style={styles.fbTagText}>{fbStatusLabel(f.status)}</Text>
          </View>
          {f.rating ? <Text style={styles.fbRating}>{'★'.repeat(f.rating)}</Text> : null}
        </View>
        {f.createdAt ? <Text style={styles.date}>{formatDate(f.createdAt)}</Text> : null}
      </View>
      <Text style={styles.fbMessage}>{f.message}</Text>
      <Text style={styles.fbFrom}>{f.displayName || t('admin.anonymous')}{f.email ? ` · ${f.email}` : ''}</Text>

      {data.updatingFeedback === f.id ? (
        <ActivityIndicator color={T.primary} style={{ marginTop: 12 }} />
      ) : (
        <View style={styles.actions}>
          {f.status !== 'nuovo' && (
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => data.setFeedbackStatus(f, 'nuovo')} accessibilityRole="button">
              <Text style={[styles.btnText, styles.btnTextSecondary]}>{t('admin.reopen')}</Text>
            </TouchableOpacity>
          )}
          {f.status === 'nuovo' && (
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => data.setFeedbackStatus(f, 'letto')} accessibilityRole="button">
              <Text style={[styles.btnText, styles.btnTextSecondary]}>{t('admin.markRead')}</Text>
            </TouchableOpacity>
          )}
          {f.status !== 'risolto' && (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => data.setFeedbackStatus(f, 'risolto')} accessibilityRole="button">
              <Text style={styles.btnText}>{t('admin.markResolved')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
