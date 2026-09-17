import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Modal, TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProducts } from '@/context/ProductsContext';
import { useAuth } from '@/context/AuthContext';
import { usePantry } from '@/context/PantryContext';
import { urgencyOf, shortDate, daysTo } from '@/lib/urgency';
import Pill from '@/components/Pill';
import QuantityStepper from '@/components/QuantityStepper';
import DateScannerModal from '@/components/DateScannerModal';
import { ocrAvailable } from '@/lib/ocr';
import { showAlert } from '@/lib/alert';
import PrimaryButton from '@/components/PrimaryButton';
import { getInitials } from '@/lib/text';
import { T, FONTS, RADIUS, SHADOW, CLAY } from '@/constants/theme';
import { Zone, ScoreGrade } from '@/types';

const GRADE_COLORS: Record<ScoreGrade, string> = {
  a: '#038141', b: '#85bb2f', c: '#fecb02', d: '#ee8100', e: '#e63e11',
};

const ZONES: { id: Zone; label: string; icon: string; sub: string }[] = [
  { id: 'frigo',    label: 'Frigo',    icon: '❄️', sub: '4 °C' },
  { id: 'freezer',  label: 'Freezer',  icon: '🧊', sub: '-18 °C' },
  { id: 'dispensa', label: 'Dispensa', icon: '📦', sub: 'Asciutto' },
];

const OPEN_EXPIRY_DAYS: Record<Zone, number> = {
  frigo: 3,
  freezer: 30,
  dispensa: 90,
};

const PRESETS = [
  { d: 1, l: '1 giorno' },
  { d: 3, l: '3 giorni' },
  { d: 7, l: '1 settimana' },
  { d: 30, l: '1 mese' },
  { d: 90, l: '3 mesi' },
];

function addDays(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, removeProduct, changeZone, editProduct, markOpened, consumeOne, consumeAll } = useProducts();
  const { user } = useAuth();
  const { activePantry } = usePantry();
  const router = useRouter();

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openPickerDay, setOpenPickerDay] = useState('');
  const [openPickerMonth, setOpenPickerMonth] = useState('');
  const [openPickerYear, setOpenPickerYear] = useState('');
  const [openExpiryPreview, setOpenExpiryPreview] = useState('');

  // ─── Modalità modifica ───────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eName, setEName] = useState('');
  const [eBrand, setEBrand] = useState('');
  const [eQty, setEQty] = useState('');
  const [eCount, setECount] = useState(1);
  const [eCategory, setECategory] = useState('');
  const [eZone, setEZone] = useState<Zone>('frigo');
  const [eExpiry, setEExpiry] = useState('');
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [expDay, setExpDay] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [showOcr, setShowOcr] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);

  const product = products.find((p) => p.id === id);
  if (!product) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: T.mute, fontFamily: FONTS.sans }}>Prodotto non trovato.</Text>
      </View>
    );
  }

  // Ha senso solo in una casa condivisa: nella dispensa personale sei
  // sempre e solo tu, dirlo sarebbe rumore.
  const addedByName = activePantry && product.addedBy
    ? (product.addedBy === user?.uid ? 'Tu' : activePantry.members[product.addedBy]?.name ?? 'Qualcuno')
    : null;

  const effectiveExpiry = product.openExpiry
    ? daysTo(product.openExpiry) < daysTo(product.expiry) ? product.openExpiry : product.expiry
    : product.expiry;

  // In modifica la card scadenza riflette la data che si sta impostando.
  const displayExpiry = editing ? eExpiry : effectiveExpiry;
  const days = daysTo(displayExpiry);
  const u = urgencyOf(days);

  const totalDays = Math.max(1,
    Math.round((new Date(product.expiry).getTime() - new Date(product.added).getTime()) / 86400000),
  );
  const elapsed = Math.max(0, Math.min(1,
    (Date.now() - new Date(product.added).getTime()) / (totalDays * 86400000),
  ));

  const openOpenModal = () => {
    const defaultDays = OPEN_EXPIRY_DAYS[product.zone];
    const defaultDate = new Date(Date.now() + defaultDays * 86400000);
    setOpenPickerDay(String(defaultDate.getDate()));
    setOpenPickerMonth(String(defaultDate.getMonth() + 1));
    setOpenPickerYear(String(defaultDate.getFullYear()));
    setOpenExpiryPreview(addDays(defaultDays));
    setShowOpenModal(true);
  };

  const syncPreview = (day: string, month: string, year: string) => {
    const d = Math.max(1, Math.min(31, parseInt(day) || 1));
    const m = Math.max(1, Math.min(12, parseInt(month) || 1));
    const y = parseInt(year) || new Date().getFullYear();
    setOpenExpiryPreview(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  };

  const confirmOpen = async () => {
    const d = Math.max(1, Math.min(31, parseInt(openPickerDay) || 1));
    const m = Math.max(1, Math.min(12, parseInt(openPickerMonth) || 1));
    const y = parseInt(openPickerYear) || new Date().getFullYear();
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    setShowOpenModal(false);
    await markOpened(product.id, iso);
  };

  const startEdit = () => {
    setEName(product.name);
    setEBrand(product.brand);
    setEQty(product.qty);
    setECount(product.count);
    setECategory(product.category);
    setEZone(product.zone);
    setEExpiry(product.expiry);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!eName.trim()) {
      showAlert('Errore', 'Inserisci il nome del prodotto');
      return;
    }
    setSaving(true);
    try {
      await editProduct(product.id, {
        name: eName.trim(),
        brand: eBrand.trim(),
        qty: eQty.trim(),
        count: eCount,
        category: eCategory.trim() || 'Altro',
        zone: eZone,
        expiry: eExpiry,
      });
      setEditing(false);
    } catch (e: any) {
      showAlert('Errore', e?.message ?? 'Impossibile salvare le modifiche');
    } finally {
      setSaving(false);
    }
  };

  const openExpiryPicker = () => {
    const d = new Date(eExpiry + 'T00:00:00');
    setExpDay(String(d.getDate()));
    setExpMonth(String(d.getMonth() + 1));
    setExpYear(String(d.getFullYear()));
    setShowExpiryPicker(true);
  };

  const confirmExpiry = () => {
    const d = Math.max(1, Math.min(31, parseInt(expDay) || 1));
    const m = Math.max(1, Math.min(12, parseInt(expMonth) || 1));
    const y = parseInt(expYear) || new Date().getFullYear();
    setEExpiry(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setShowExpiryPicker(false);
  };

  // Con più unità il consumo è immediato (scala il contatore); quando resta
  // l'ultima il prodotto sparisce dalla dispensa, quindi chiediamo conferma.
  const handleConsumeOne = async () => {
    if (product.count > 1) {
      await consumeOne(product.id);
      return;
    }
    showAlert(
      'Consumato',
      `Hai finito "${product.name}"? Verrà rimosso dalla dispensa.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Consumato',
          onPress: async () => {
            await consumeOne(product.id);
            router.back();
          },
        },
      ],
    );
  };

  const handleConsumeAll = () => {
    showAlert(
      'Consuma tutto',
      `Hai consumato tutte le ${product.count} unità di "${product.name}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Consumato',
          onPress: async () => {
            await consumeAll(product.id);
            router.back();
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    showAlert(
      'Rimuovi prodotto',
      `Vuoi rimuovere "${product.name}" dalla dispensa?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: async () => {
            await removeProduct(product.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity
            onPress={() => (editing ? cancelEdit() : router.back())}
            style={styles.navBtn}
          >
            <Ionicons name={editing ? 'close' : 'chevron-back'} size={20} color={T.ink} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {editing ? (
              <TouchableOpacity
                style={[styles.navBtn, styles.navBtnSave]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fbfaf3" size="small" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#fbfaf3" />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.navBtn} onPress={startEdit}>
                <Ionicons name="create-outline" size={19} color={T.ink} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: product.tint || T.primarySoft }]}>
          <Text style={styles.heroInitials}>
            {getInitials(editing ? eName : product.name)}
          </Text>
          <Text style={styles.heroBrand}>{(editing ? eBrand : product.brand).toUpperCase()}</Text>
          <Text style={styles.heroName}>{editing ? (eName || 'Senza nome') : product.name}</Text>
          <Text style={styles.heroSub}>
            {(editing ? eCount : product.count) > 1 ? `${editing ? eCount : product.count} × ` : ''}
            {(editing ? eQty : product.qty)} · {(editing ? (eCategory || 'Altro') : product.category)}
          </Text>
          {product.openedAt && (
            <View style={styles.openedHeroBadge}>
              <Text style={styles.openedHeroBadgeText}>🔓 Aperto il {shortDate(product.openedAt)}</Text>
            </View>
          )}
        </View>

        {/* Form di modifica */}
        {editing && (
          <View style={styles.section}>
            <View style={styles.editCard}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Nome</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={eName}
                  onChangeText={setEName}
                  placeholder="es. Latte intero"
                  placeholderTextColor={T.mute}
                />
              </View>
              <View style={styles.fieldDivider} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Marca</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={eBrand}
                  onChangeText={setEBrand}
                  placeholder="es. Granarolo"
                  placeholderTextColor={T.mute}
                />
              </View>
              <View style={styles.fieldDivider} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Quantità</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={eQty}
                  onChangeText={setEQty}
                  placeholder="es. 1 L"
                  placeholderTextColor={T.mute}
                />
              </View>
              <View style={styles.fieldDivider} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Unità</Text>
                <View style={{ flex: 1 }}>
                  <QuantityStepper value={eCount} onChange={setECount} />
                </View>
              </View>
              <View style={styles.fieldDivider} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Categoria</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={eCategory}
                  onChangeText={setECategory}
                  placeholder="es. Latticini"
                  placeholderTextColor={T.mute}
                />
              </View>
            </View>
          </View>
        )}

        {/* Expiry card */}
        <View style={styles.section}>
          <View style={[styles.expiryCard, { backgroundColor: u.soft }]}>
            <View style={styles.expiryLeft}>
              <View style={[styles.expiryIcon, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                <Text style={{ fontSize: 26 }}>⏰</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.expiryLabel, { color: u.ink }]}>{u.label.toUpperCase()}</Text>
                <Text style={[styles.expiryDate, { color: u.ink }]}>{shortDate(displayExpiry)}</Text>
                {product.openedAt && product.openExpiry && (
                  <Text style={[styles.expiryAdded, { color: u.ink, opacity: 0.8 }]}>
                    Da consumare entro dopo apertura
                  </Text>
                )}
                {!(product.openedAt && product.openExpiry) && (
                  <Text style={[styles.expiryAdded, { color: u.ink, opacity: 0.7 }]}>
                    Aggiunto il {shortDate(product.added)}{addedByName ? ` da ${addedByName}` : ''}
                  </Text>
                )}
                {product.openedAt && product.openExpiry && daysTo(product.expiry) > daysTo(product.openExpiry) && (
                  <Text style={[styles.expiryOriginal, { color: u.ink }]}>
                    Scad. originale: {shortDate(product.expiry)}
                  </Text>
                )}
              </View>
            </View>
            {/* Progress bar */}
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${elapsed * 100}%` as any, backgroundColor: u.color }]}
              />
            </View>
          </View>
        </View>

        {/* Azioni modifica scadenza */}
        {editing && (
          <View style={styles.section}>
            <View style={styles.editExpiryActions}>
              <TouchableOpacity style={styles.editDateBtn} onPress={openExpiryPicker} activeOpacity={0.85}>
                <Ionicons name="calendar-outline" size={17} color={T.ink} />
                <Text style={styles.editDateBtnText}>Cambia data</Text>
              </TouchableOpacity>
              {ocrAvailable && (
                <TouchableOpacity style={styles.editOcrBtn} onPress={() => setShowOcr(true)} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={17} color={T.primaryInk} />
                  <Text style={styles.editOcrBtnText}>Scansiona</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Open product action */}
        {!editing && (
        <View style={styles.section}>
          {!product.openedAt ? (
            <TouchableOpacity style={styles.openBtn} onPress={openOpenModal} activeOpacity={0.85}>
              <Ionicons name="lock-open-outline" size={22} color={T.primaryInk} />
              <View style={{ flex: 1 }}>
                <Text style={styles.openBtnTitle}>
                  {product.count > 1 ? 'Apri una unità' : 'Segna come aperto'}
                </Text>
                <Text style={styles.openBtnSub}>
                  {product.count > 1
                    ? `Le altre ${product.count - 1} restano chiuse con la scadenza originale`
                    : product.zone === 'frigo' ? 'Calcola scadenza post-apertura (3 giorni)'
                    : product.zone === 'dispensa' ? 'Calcola scadenza post-apertura (3 mesi)'
                    : 'Calcola scadenza post-apertura (30 giorni)'}
                </Text>
              </View>
              <Text style={styles.openBtnArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.openBtnActive} onPress={openOpenModal} activeOpacity={0.85}>
              <Ionicons name="lock-open-outline" size={22} color={T.primaryInk} />
              <View style={{ flex: 1 }}>
                <Text style={styles.openBtnTitleActive}>Prodotto aperto</Text>
                <Text style={styles.openBtnSubActive}>
                  Aperto il {shortDate(product.openedAt)} · consuma entro {product.openExpiry ? shortDate(product.openExpiry) : '—'}
                </Text>
              </View>
              <Text style={styles.openBtnArrowActive}>›</Text>
            </TouchableOpacity>
          )}
        </View>
        )}

        {/* Zone selector */}
        <Text style={styles.sectionTitle}>Conservazione</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            {ZONES.map((z, i) => {
              const active = (editing ? eZone : product.zone) === z.id;
              return (
                <React.Fragment key={z.id}>
                  <TouchableOpacity
                    style={styles.zoneRow}
                    onPress={() => (editing ? setEZone(z.id) : changeZone(product.id, z.id))}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.zoneIconBox, { backgroundColor: active ? T.primary : T.primarySoft }]}>
                      <Text style={{ fontSize: 20 }}>{z.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.zoneLabel}>{z.label}</Text>
                      <Text style={styles.zoneSub}>{z.sub}</Text>
                    </View>
                    {active && (
                      <View style={styles.checkBadge}>
                        <Text style={{ color: '#fbfaf3', fontSize: 14 }}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {i < ZONES.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Details */}
        {!editing && (
        <>
        <Text style={styles.sectionTitle}>Dettagli</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            {[
              { label: 'Codice a barre', value: product.barcode || '—' },
              { label: 'Categoria', value: product.category },
              { label: 'Apporto', value: product.cal ? `${product.cal} kcal / 100g` : '—' },
            ].map((row, i, arr) => (
              <React.Fragment key={row.label}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Info nutrizionali (solo se presenti — dati portati dal barcode) */}
        {(product.nutrition || product.allergens?.length || product.nutriscore || product.ecoscore) && (
          <View style={styles.section}>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.nutritionToggle}
                onPress={() => setShowNutrition((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.nutritionToggleText}>🥗 Informazioni nutrizionali</Text>
                <Text style={styles.nutritionToggleIcon}>{showNutrition ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showNutrition && (
                <View style={styles.nutritionBody}>
                  {(product.nutriscore || product.ecoscore) && (
                    <View style={styles.scoreRow}>
                      {product.nutriscore && (
                        <View style={styles.scoreBadge}>
                          <View style={[styles.scoreCircle, { backgroundColor: GRADE_COLORS[product.nutriscore] }]}>
                            <Text style={styles.scoreCircleText}>{product.nutriscore.toUpperCase()}</Text>
                          </View>
                          <Text style={styles.scoreLabel}>Nutri-Score</Text>
                        </View>
                      )}
                      {product.ecoscore && (
                        <View style={styles.scoreBadge}>
                          <View style={[styles.scoreCircle, { backgroundColor: GRADE_COLORS[product.ecoscore] }]}>
                            <Text style={styles.scoreCircleText}>{product.ecoscore.toUpperCase()}</Text>
                          </View>
                          <Text style={styles.scoreLabel}>Eco-Score</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {product.nutrition && (
                    <View>
                      <Text style={styles.nutritionCaption}>Valori per 100g/100ml</Text>
                      {[
                        { label: 'Calorie', value: product.nutrition.calories, unit: 'kcal' },
                        { label: 'Proteine', value: product.nutrition.proteins, unit: 'g' },
                        { label: 'Grassi', value: product.nutrition.fat, unit: 'g' },
                        { label: 'Carboidrati', value: product.nutrition.carbs, unit: 'g' },
                        { label: 'di cui zuccheri', value: product.nutrition.sugars, unit: 'g' },
                        { label: 'Sale', value: product.nutrition.salt, unit: 'g' },
                      ].filter((r) => r.value !== undefined).map((r) => (
                        <View key={r.label} style={styles.nutritionRow}>
                          <Text style={styles.nutritionRowLabel}>{r.label}</Text>
                          <Text style={styles.nutritionRowValue}>{r.value} {r.unit}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {product.allergens && product.allergens.length > 0 && (
                    <View>
                      <Text style={styles.nutritionCaption}>Allergeni</Text>
                      <View style={styles.allergensRow}>
                        {product.allergens.map((a) => (
                          <View key={a} style={styles.allergenPill}>
                            <Text style={styles.allergenPillText}>{a}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Consumo */}
        <View style={styles.section}>
          <Pill
            variant="primary"
            size="lg"
            onPress={handleConsumeOne}
            style={{ justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: FONTS.sansSemiBold, color: '#fbfaf3', fontSize: 16 }}>
              ✓ Consumato{product.count > 1 ? ` (ne restano ${product.count - 1})` : ''}
            </Text>
          </Pill>
          {product.count > 1 && (
            <TouchableOpacity onPress={handleConsumeAll} activeOpacity={0.85} style={styles.consumeAllBtn}>
              <Text style={styles.consumeAllText}>Consuma tutte le {product.count} unità</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Delete */}
        <View style={styles.section}>
          <Pill
            variant="ghost"
            size="lg"
            onPress={handleDelete}
            style={{ borderColor: 'rgba(189,74,48,0.2)', justifyContent: 'center' }}
          >
            <Ionicons name="trash-outline" size={17} color={T.urgent} />
            <Text style={{ fontFamily: FONTS.sansSemiBold, color: T.urgent, fontSize: 16 }}>
              Rimuovi dalla dispensa
            </Text>
          </Pill>
        </View>
        </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Open product modal */}
      <Modal
        visible={showOpenModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOpenModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOpenModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Prodotto aperto</Text>
            <Text style={styles.modalSub}>
              Scegli entro quando consumarlo dopo l'apertura
            </Text>

            {/* Quick presets */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.d}
                  style={styles.preset}
                  onPress={() => {
                    const d = new Date(Date.now() + p.d * 86400000);
                    const day = String(d.getDate());
                    const month = String(d.getMonth() + 1);
                    const year = String(d.getFullYear());
                    setOpenPickerDay(day);
                    setOpenPickerMonth(month);
                    setOpenPickerYear(year);
                    syncPreview(day, month, year);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.presetText}>+{p.l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Date inputs */}
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Giorno</Text>
                <TextInput
                  style={styles.pickerInput}
                  value={openPickerDay}
                  onChangeText={(v) => { setOpenPickerDay(v); syncPreview(v, openPickerMonth, openPickerYear); }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Mese</Text>
                <TextInput
                  style={styles.pickerInput}
                  value={openPickerMonth}
                  onChangeText={(v) => { setOpenPickerMonth(v); syncPreview(openPickerDay, v, openPickerYear); }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Anno</Text>
                <TextInput
                  style={styles.pickerInput}
                  value={openPickerYear}
                  onChangeText={(v) => { setOpenPickerYear(v); syncPreview(openPickerDay, openPickerMonth, v); }}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                />
              </View>
            </View>

            {openExpiryPreview ? (
              <Text style={styles.modalPreviewDate}>
                Scade il {shortDate(openExpiryPreview)} ({daysTo(openExpiryPreview)} giorni)
              </Text>
            ) : null}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowOpenModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <PrimaryButton onPress={confirmOpen} icon="lock-open-outline" label="Conferma apertura" containerStyle={{ flex: 2 }} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Expiry picker modal (modifica) */}
      <Modal
        visible={showExpiryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExpiryPicker(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowExpiryPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Data di scadenza</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.d}
                  style={styles.preset}
                  onPress={() => {
                    const d = new Date(Date.now() + p.d * 86400000);
                    setExpDay(String(d.getDate()));
                    setExpMonth(String(d.getMonth() + 1));
                    setExpYear(String(d.getFullYear()));
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.presetText}>+{p.l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Giorno</Text>
                <TextInput style={styles.pickerInput} value={expDay} onChangeText={setExpDay} keyboardType="number-pad" maxLength={2} selectTextOnFocus />
              </View>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Mese</Text>
                <TextInput style={styles.pickerInput} value={expMonth} onChangeText={setExpMonth} keyboardType="number-pad" maxLength={2} selectTextOnFocus />
              </View>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Anno</Text>
                <TextInput style={styles.pickerInput} value={expYear} onChangeText={setExpYear} keyboardType="number-pad" maxLength={4} selectTextOnFocus />
              </View>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowExpiryPicker(false)} activeOpacity={0.85}>
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <PrimaryButton onPress={confirmExpiry} label="Conferma" containerStyle={{ flex: 2 }} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* OCR camera modal (modifica) */}
      <DateScannerModal
        visible={showOcr}
        onClose={() => setShowOcr(false)}
        onResult={(iso) => setEExpiry(iso)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 32 },

  nav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 8,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  navBtnSave: { backgroundColor: T.primary },

  editCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.card,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  fieldLabel: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.ink2, width: 80 },
  fieldInput: { flex: 1, fontFamily: FONTS.sans, fontSize: 15, color: T.ink, padding: 0, fontWeight: '500' },
  fieldDivider: { height: 0.5, backgroundColor: T.line, marginLeft: 16 },

  editExpiryActions: { flexDirection: 'row', gap: 10 },
  editDateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.surface, borderRadius: RADIUS.lg, paddingVertical: 14,
    borderWidth: 1, borderColor: T.line, ...SHADOW.card,
  },
  editDateBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.ink },
  editOcrBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.primarySoft, borderRadius: RADIUS.lg, paddingVertical: 14,
  },
  editOcrBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primaryInk },

  hero: {
    margin: 16, borderRadius: 28, padding: 24,
    alignItems: 'center', gap: 6,
  },
  heroInitials: {
    fontFamily: FONTS.serifItalic, fontSize: 90, color: 'rgba(20,28,16,0.78)',
    lineHeight: 90, letterSpacing: -3,
  },
  heroBrand: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: 'rgba(20,28,16,0.55)', letterSpacing: 0.5,
  },
  heroName: {
    fontFamily: FONTS.serifItalic, fontSize: 28, color: T.ink, letterSpacing: -0.5, lineHeight: 32,
    textAlign: 'center',
  },
  heroSub: { fontSize: 12, color: T.ink2, fontFamily: FONTS.sans },
  openedHeroBadge: {
    backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 100,
    paddingVertical: 6, paddingHorizontal: 14, marginTop: 4,
  },
  openedHeroBadgeText: { fontSize: 12, fontFamily: FONTS.sansSemiBold, color: '#2d5c2d' },

  section: { paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3,
    paddingHorizontal: 20, marginBottom: 12,
  },

  expiryCard: { borderRadius: RADIUS.xl, padding: 18 },
  expiryLeft: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 14 },
  expiryIcon: { width: 52, height: 52, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  expiryLabel: { fontSize: 12, fontFamily: FONTS.sansBold, letterSpacing: 0.4, textTransform: 'uppercase' },
  expiryDate: { fontFamily: FONTS.serifItalic, fontSize: 28, letterSpacing: -0.4, lineHeight: 32 },
  expiryAdded: { fontSize: 12, fontFamily: FONTS.sans, marginTop: 4 },
  expiryOriginal: { fontSize: 11, fontFamily: FONTS.sans, marginTop: 2, opacity: 0.6 },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100 },

  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 16,
    borderWidth: 1, borderColor: T.line, ...SHADOW.card,
  },
  openBtnActive: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#e8f0e8', borderRadius: RADIUS.lg, padding: 16,
    borderWidth: 1, borderColor: 'rgba(58,107,58,0.2)',
  },
  openBtnTitle: { fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink },
  openBtnSub: { fontSize: 12, color: T.mute, marginTop: 1, fontFamily: FONTS.sans },
  openBtnTitleActive: { fontSize: 14, fontFamily: FONTS.sansSemiBold, color: '#2d5c2d' },
  openBtnSubActive: { fontSize: 12, color: '#4a8050', marginTop: 1, fontFamily: FONTS.sans },
  openBtnArrow: { fontSize: 18, color: T.mute },
  openBtnArrowActive: { fontSize: 18, color: '#3a6b3a' },

  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.card,
  },
  zoneRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16, gap: 14,
  },
  zoneIconBox: {
    width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  zoneLabel: { fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink },
  zoneSub: { fontSize: 11, color: T.mute, marginTop: 1, fontFamily: FONTS.sans },
  checkBadge: {
    width: 22, height: 22, borderRadius: 100, backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 0.5, backgroundColor: T.line, marginLeft: 16 },

  detailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  detailLabel: { fontSize: 13, color: T.mute, fontFamily: FONTS.sans, flex: 1 },
  detailValue: {
    fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink,
  },

  nutritionToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  nutritionToggleText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.ink },
  nutritionToggleIcon: { fontSize: 11, color: T.mute },
  nutritionBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  scoreRow: { flexDirection: 'row', gap: 24 },
  scoreBadge: { alignItems: 'center', gap: 4 },
  scoreCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scoreCircleText: { fontFamily: FONTS.sansBold, fontSize: 15, color: '#fff' },
  scoreLabel: { fontSize: 11, fontFamily: FONTS.sansMedium, color: T.mute },
  nutritionCaption: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.4,
    marginBottom: 4,
  },
  nutritionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: T.line,
  },
  nutritionRowLabel: { fontSize: 13, fontFamily: FONTS.sans, color: T.ink2 },
  nutritionRowValue: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.ink },
  allergensRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  consumeAllBtn: { alignItems: 'center', paddingVertical: 12 },
  consumeAllText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.mute },
  allergenPill: {
    backgroundColor: T.warnSoft, borderRadius: RADIUS.tag,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  allergenPillText: { fontSize: 12, fontFamily: FONTS.sansMedium, color: T.warn },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: T.surface, borderRadius: 24, padding: 24,
    width: 320, gap: 14,
  },
  modalTitle: { fontFamily: FONTS.serifItalic, fontSize: 24, color: T.ink, letterSpacing: -0.3 },
  modalSub: { fontSize: 13, color: T.mute, fontFamily: FONTS.sans, marginTop: -6 },
  modalPreviewDate: {
    fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.primaryInk,
    textAlign: 'center', paddingVertical: 4,
  },
  preset: {
    backgroundColor: T.bg, borderRadius: RADIUS.md,
    paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: T.line,
  },
  presetText: { fontSize: 12, fontFamily: FONTS.sansSemiBold, color: T.ink2 },
  pickerRow: { flexDirection: 'row', gap: 12 },
  pickerCol: { flex: 1, alignItems: 'center', gap: 6 },
  pickerLabel: { fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.4 },
  pickerInput: {
    width: '100%', textAlign: 'center',
    backgroundColor: '#ece8de', borderRadius: RADIUS.input,
    paddingVertical: 12, fontSize: 20, fontFamily: FONTS.sansBold, color: T.ink,
    boxShadow: CLAY.inset,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1, borderRadius: RADIUS.lg, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: T.line,
  },
  modalCancelText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.mute },
});
