import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { createAdminStyles } from './adminStyles';
import type { AdminData } from './useAdminData';

export function SurveysPanel({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useThemedStyles(createAdminStyles);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const create = async () => {
    if (await data.createSurvey(question, options)) {
      setQuestion('');
      setOptions(['', '']);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.newSurveyTitle')}</Text>
        <TextInput
          style={styles.surveyInput}
          value={question}
          onChangeText={setQuestion}
          placeholder={t('admin.surveyQuestionPlaceholder')}
          placeholderTextColor={T.mute}
          multiline
        />
        {options.map((opt, i) => (
          <View key={i} style={styles.surveyOptionRow}>
            <TextInput
              style={[styles.surveyInput, { flex: 1, marginTop: 0 }]}
              value={opt}
              onChangeText={(v) => setOptions((prev) => prev.map((o, j) => (j === i ? v : o)))}
              placeholder={t('admin.surveyOptionPlaceholder', { n: i + 1 })}
              placeholderTextColor={T.mute}
            />
            {options.length > 2 && (
              <TouchableOpacity
                onPress={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                style={styles.surveyRemoveBtn}
                accessibilityRole="button"
              >
                <Text style={styles.surveyRemoveText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <View style={styles.surveyActions}>
          <TouchableOpacity onPress={() => setOptions((prev) => [...prev, ''])} style={styles.smallBtn} activeOpacity={0.85}>
            <Text style={styles.smallBtnText}>{t('admin.surveyAddOption')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={create}
            disabled={data.creatingSurvey}
            style={[styles.primaryAction, data.creatingSurvey && { opacity: 0.6 }]}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryActionText}>{t('admin.surveyCreate')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {data.surveys.map((s) => {
        const res = data.surveyResults[s.id];
        const answered = res ? res.counts.reduce((a, b) => a + b, 0) : 0;
        return (
          <View key={s.id} style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                {/* Senza questo non si capisce perché un sondaggio appena
                    creato non compaia agli utenti. */}
                <View style={[styles.surveyState, s.active && styles.surveyStateOn]}>
                  <Text style={[styles.surveyStateText, s.active && styles.surveyStateTextOn]}>
                    {s.active ? t('admin.surveyActive') : t('admin.surveyDraft')}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>{s.question}</Text>
                <Text style={styles.cardDesc}>
                  {t('admin.surveyAnswers', { count: answered })}
                  {res && res.dismissed > 0 ? ` · ${t('admin.surveyDismissed', { count: res.dismissed })}` : ''}
                </Text>
              </View>
              <Switch
                value={s.active}
                onValueChange={(v) => data.setSurveyActive(s.id, v)}
                trackColor={{ false: T.line, true: T.primary }}
                accessibilityLabel={s.question}
              />
            </View>

            <View style={{ gap: 8, marginTop: 12 }}>
              {s.options.map((opt, i) => {
                const n = res?.counts[i] ?? 0;
                const share = answered > 0 ? Math.round((n / answered) * 100) : 0;
                return (
                  <View key={i}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel} numberOfLines={1}>{opt}</Text>
                      <Text style={styles.resultValue}>{n} · {share}%</Text>
                    </View>
                    <View style={styles.resultBarTrack}>
                      <View style={[styles.resultBarFill, { width: `${share}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity onPress={() => data.deleteSurvey(s.id)} style={{ marginTop: 12, alignSelf: 'flex-start' }} accessibilityRole="button">
              <Text style={styles.surveyDeleteText}>{t('admin.surveyDelete')}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}
