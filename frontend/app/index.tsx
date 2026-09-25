/* eslint-disable no-dupe-keys */
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

type Category = { id: string; name: string };
type Payment = { id: string; amount: number; categoryId: string; date: string; note: string };
type LedgerState = { categories: Category[]; payments: Payment[] };
type ModalName = "actions" | "payment" | "categories" | "export" | null;

const STORAGE_KEY = "ledger-offline-state-v1";
const DEFAULT_CATEGORIES = ["Food", "Transport", "Bills", "Shopping", "Health", "Entertainment", "Other"];

const todayString = () => {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
};
const dateValue = (value: string) => {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year || month > 12 || day > 31) return 0;
  return new Date(year, month - 1, day).getTime();
};
const money = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function Index() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const [state, setState] = useState<LedgerState>({ categories: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modal, setModal] = useState<ModalName>(null);
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | null>(null);
  const [undoPayment, setUndoPayment] = useState<Payment | null>(null);

  useEffect(() => {
    storage.getItem<LedgerState>(STORAGE_KEY, { categories: [], payments: [] }).then((saved) => {
      const next = saved?.categories?.length ? saved : { categories: DEFAULT_CATEGORIES.map((name) => ({ id: uid(), name })), payments: [] };
      setState(next);
      setLoading(false);
    });
  }, []);

  const persist = useCallback(async (next: LedgerState) => {
    setState(next);
    await storage.setItem(STORAGE_KEY, next);
  }, []);

  const visiblePayments = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === "week") {
      const day = now.getDay() || 7;
      start.setDate(now.getDate() - day + 1);
    }
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return state.payments.filter((item) => {
      const value = dateValue(item.date);
      return value >= start.getTime() && value < end.getTime() && (categoryFilter === "all" || item.categoryId === categoryFilter);
    }).sort((a, b) => dateValue(b.date) - dateValue(a.date));
  }, [categoryFilter, period, state.payments]);
  const total = visiblePayments.reduce((sum, item) => sum + item.amount, 0);
  const categoryTotals = useMemo(() => state.categories.map((category) => ({ category, total: visiblePayments.filter((p) => p.categoryId === category.id).reduce((sum, p) => sum + p.amount, 0) })).filter((item) => item.total > 0), [state.categories, visiblePayments]);
  const categoryName = (id: string) => state.categories.find((category) => category.id === id)?.name ?? "Unknown";

  const removePayment = (payment: Payment) => {
    Alert.alert("Delete spend?", `${money(payment.amount)} will be removed from your ledger.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await persist({ ...state, payments: state.payments.filter((item) => item.id !== payment.id) }); setUndoPayment(payment); } },
    ]);
  };
  const undo = async () => {
    if (!undoPayment) return;
    await persist({ ...state, payments: [...state.payments, undoPayment] });
    setUndoPayment(null);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.brandPrimary} /><Text style={styles.muted}>Loading your ledger…</Text></View>;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 110 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>OFFLINE LEDGER</Text><Text style={styles.title}>Good to see you.</Text></View>
          <Pressable onPress={() => setModal("export")} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityLabel="Export PDF" testID="export-header-button"><Ionicons name="download-outline" size={21} color={colors.onSurface} /></Pressable>
        </View>
        <View style={styles.totalCard}>
          <View style={styles.totalTop}><Text style={styles.totalLabel}>Total spent</Text><Ionicons name="wallet-outline" size={24} color={colors.onBrandPrimary} /></View>
          <Text style={styles.totalAmount}>{money(total)}</Text>
          <View style={styles.segmented}>
            {(["month", "week"] as const).map((item) => <Pressable key={item} onPress={() => setPeriod(item)} style={[styles.segment, period === item && styles.segmentActive]}><Text style={[styles.segmentText, period === item && styles.segmentTextActive]}>{item === "month" ? "This month" : "This week"}</Text></Pressable>)}
          </View>
        </View>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Spending overview</Text><Text style={styles.muted}>See where your money goes</Text></View><CategoryDropdown value={categoryFilter} categories={state.categories} onChange={setCategoryFilter} compact /></View>
        {categoryTotals.length ? <View style={styles.breakdownCard}>{categoryTotals.map(({ category, total: categoryTotal }, index) => <View key={category.id} style={styles.breakdownRow}><View style={styles.breakdownLine}><View style={[styles.dot, { backgroundColor: [colors.info, colors.success, colors.warning, colors.error, colors.brandSecondary][index % 5] }]} /><Text style={styles.body}>{category.name}</Text><Text style={[styles.bodyStrong, { marginLeft: "auto" }]}>{money(categoryTotal)}</Text></View><View style={styles.progressTrack}><View style={[styles.progress, { width: `${Math.max(5, (categoryTotal / total) * 100)}%`, backgroundColor: [colors.info, colors.success, colors.warning, colors.error, colors.brandSecondary][index % 5] }]} /></View></View>)}</View> : <View style={styles.emptyCard}><Ionicons name="pie-chart-outline" size={30} color={colors.muted} /><Text style={styles.emptyTitle}>No spends yet</Text><Text style={styles.muted}>Add your first spend to see the breakdown.</Text></View>}
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Recent spends</Text><Text style={styles.muted}>{visiblePayments.length ? `${visiblePayments.length} transaction${visiblePayments.length === 1 ? "" : "s"}` : "Nothing in this period"}</Text></View></View>
        {visiblePayments.length ? visiblePayments.map((payment) => <View style={styles.paymentRow} key={payment.id}><View style={styles.paymentIcon}><Ionicons name="receipt-outline" size={18} color={colors.onSurfaceSecondary} /></View><View style={styles.paymentInfo}><Text style={styles.bodyStrong}>{categoryName(payment.categoryId)}</Text><Text style={styles.muted}>{payment.date}{payment.note ? `  ·  ${payment.note}` : ""}</Text></View><View style={styles.paymentRight}><Text style={styles.amount}>{money(payment.amount)}</Text><View style={styles.rowActions}><Pressable onPress={() => { setPaymentToEdit(payment); setModal("payment"); }} hitSlop={8} accessibilityLabel="Edit spend"><Ionicons name="create-outline" size={18} color={colors.muted} /></Pressable><Pressable onPress={() => removePayment(payment)} hitSlop={8} accessibilityLabel="Delete spend"><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable></View></View></View>) : <View style={styles.emptyList}><Text style={styles.muted}>Try another period or add a new payment.</Text></View>}
        <Text style={styles.footer}>Made by Subhasish  ·  Stored only on this phone</Text>
      </ScrollView>
      {undoPayment && !modal ? <View style={[styles.snackbar, { bottom: insets.bottom + 88 }]}><Text style={styles.snackText}>Spend deleted</Text><Pressable onPress={undo} hitSlop={10}><Text style={styles.undoText}>Undo</Text></Pressable></View> : null}
      {!modal ? <Pressable onPress={() => setModal("actions")} style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20 }, pressed && styles.fabPressed]} accessibilityLabel="Add or export actions" testID="add-actions-button"><Ionicons name="add" size={30} color={colors.onBrandPrimary} /></Pressable> : null}
      <AppModal modal={modal} onClose={() => { setModal(null); setPaymentToEdit(null); }}>
        {modal === "actions" ? <ActionSheet onSelect={(name) => { setModal(name); }} /> : null}
        {modal === "payment" ? <PaymentForm initial={paymentToEdit} state={state} onSave={async (payment) => { const payments = paymentToEdit ? state.payments.map((item) => item.id === payment.id ? payment : item) : [...state.payments, payment]; await persist({ ...state, payments }); setModal(null); setPaymentToEdit(null); }} /> : null}
        {modal === "categories" ? <CategoryManager state={state} persist={persist} /> : null}
        {modal === "export" ? <ExportForm state={state} /> : null}
      </AppModal>
    </View>
  );
}

function CategoryDropdown({ value, categories, onChange, compact = false }: { value: string; categories: Category[]; onChange: (value: string) => void; compact?: boolean }) {
  const { colors } = useTheme(); const styles = useStyles(); const [open, setOpen] = useState(false);
  const label = value === "all" ? "All categories" : categories.find((item) => item.id === value)?.name ?? "Choose category";
  return <View style={styles.dropdownWrap}><Pressable onPress={() => setOpen((item) => !item)} style={[styles.dropdown, compact && styles.dropdownCompact]}><Text numberOfLines={1} style={styles.dropdownText}>{label}</Text><Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} /></Pressable>{open ? <View style={styles.dropdownMenu}><Pressable onPress={() => { onChange("all"); setOpen(false); }} style={styles.dropdownOption}><Text style={styles.body}>All categories</Text></Pressable>{categories.map((item) => <Pressable key={item.id} onPress={() => { onChange(item.id); setOpen(false); }} style={styles.dropdownOption}><Text style={styles.body}>{item.name}</Text></Pressable>)}</View> : null}</View>;
}

function AppModal({ modal, onClose, children }: { modal: ModalName; onClose: () => void; children: ReactNode }) {
  return <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}><View style={{ flex: 1, justifyContent: "flex-end" }}><Pressable style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} onPress={onClose} /><View>{children}</View></View></KeyboardAvoidingView></Modal>;
}

function SheetHeader({ title, subtitle }: { title: string; subtitle?: string }) { const styles = useStyles(); return <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>{title}</Text>{subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}</View></View>; }

function ActionSheet({ onSelect }: { onSelect: (name: Exclude<ModalName, null | "actions">) => void }) { const { colors } = useTheme(); const styles = useStyles(); return <View style={styles.sheet}><SheetHeader title="Quick actions" subtitle="Keep your ledger up to date" />{[["add-circle-outline", "Add payment", "payment"], ["pricetags-outline", "Manage categories", "categories"], ["document-text-outline", "Download PDF", "export"]].map(([icon, label, name]) => <Pressable key={name} onPress={() => onSelect(name as Exclude<ModalName, null | "actions">)} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}><View style={styles.actionIcon}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={21} color={colors.onSurface} /></View><Text style={styles.bodyStrong}>{label}</Text><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}</View>; }

function PaymentForm({ initial, state, onSave }: { initial: Payment | null; state: LedgerState; onSave: (payment: Payment) => Promise<void> }) { const { colors } = useTheme(); const styles = useStyles(); const [amount, setAmount] = useState(initial ? String(initial.amount) : ""); const [categoryId, setCategoryId] = useState(initial?.categoryId ?? state.categories[0]?.id ?? ""); const [date, setDate] = useState(initial?.date ?? todayString()); const [note, setNote] = useState(initial?.note ?? ""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const valid = Number(amount) > 0 && dateValue(date) > 0 && Boolean(categoryId);
  return <View style={styles.sheet}><SheetHeader title={initial ? "Edit payment" : "Add payment"} subtitle="A clear record makes spending easier to understand" /><Text style={styles.fieldLabel}>Amount</Text><View style={styles.amountInput}><Text style={styles.currency}>₹</Text><TextInput autoFocus={!initial} value={amount} onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} style={styles.amountTextInput} /></View><Text style={styles.fieldLabel}>Category</Text><CategoryDropdown value={categoryId} categories={state.categories} onChange={setCategoryId} /><Text style={styles.fieldLabel}>Date</Text><TextInput value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" placeholder="DD/MM/YYYY" placeholderTextColor={colors.muted} style={styles.input} maxLength={10} /><Text style={styles.fieldLabel}>Note <Text style={styles.optional}>Optional</Text></Text><TextInput value={note} onChangeText={setNote} placeholder="What was this for?" placeholderTextColor={colors.muted} style={[styles.input, styles.noteInput]} multiline maxLength={80} />{error ? <Text style={styles.errorText}>{error}</Text> : null}<Pressable disabled={!valid || saving} onPress={async () => { if (!valid) { setError("Enter an amount, category, and valid date."); return; } setSaving(true); await onSave({ id: initial?.id ?? uid(), amount: Number(amount), categoryId, date, note: note.trim() }); setSaving(false); }} style={({ pressed }) => [styles.primaryButton, (!valid || saving) && styles.disabled, pressed && styles.pressed]}>{saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>{initial ? "Save changes" : "Save spend"}</Text>}</Pressable></View>; }

function CategoryManager({ state, persist }: { state: LedgerState; persist: (next: LedgerState) => Promise<void> }) { const { colors } = useTheme(); const styles = useStyles(); const [name, setName] = useState(""); const [editing, setEditing] = useState<Category | null>(null); const [deleteTarget, setDeleteTarget] = useState<Category | null>(null); const [transferId, setTransferId] = useState(""); const addOrEdit = async () => { const clean = name.trim(); if (!clean) return; if (editing) await persist({ ...state, categories: state.categories.map((item) => item.id === editing.id ? { ...item, name: clean } : item) }); else await persist({ ...state, categories: [...state.categories, { id: uid(), name: clean }] }); setName(""); setEditing(null); };
  const deleteCategory = async () => { if (!deleteTarget || !transferId) return; await persist({ categories: state.categories.filter((item) => item.id !== deleteTarget.id), payments: state.payments.map((item) => item.categoryId === deleteTarget.id ? { ...item, categoryId: transferId } : item) }); setDeleteTarget(null); setTransferId(""); };
  return <View style={styles.sheet}><SheetHeader title="Categories" subtitle="Edit labels or move spends before deleting" /><View style={styles.inlineForm}><TextInput value={name} onChangeText={setName} placeholder={editing ? "Rename category" : "New category name"} placeholderTextColor={colors.muted} style={[styles.input, styles.inlineInput]} /><Pressable onPress={addOrEdit} style={styles.smallButton}><Ionicons name={editing ? "checkmark" : "add"} size={20} color={colors.onBrandPrimary} /></Pressable></View>{state.categories.map((category) => { const hasSpends = state.payments.some((item) => item.categoryId === category.id); return <View key={category.id} style={styles.categoryRow}><View style={styles.categoryBullet}><Text style={styles.categoryBulletText}>{category.name.charAt(0).toUpperCase()}</Text></View><Text style={[styles.bodyStrong, { flex: 1 }]}>{category.name}</Text>{hasSpends ? <Text style={styles.miniBadge}>USED</Text> : null}<Pressable onPress={() => { setEditing(category); setName(category.name); }} hitSlop={8} style={styles.rowIcon}><Ionicons name="create-outline" size={19} color={colors.muted} /></Pressable><Pressable onPress={() => { if (state.categories.length <= 1) Alert.alert("Keep one category", "Add another category before deleting this one."); else if (hasSpends) { setDeleteTarget(category); setTransferId(state.categories.find((item) => item.id !== category.id)?.id ?? ""); } else Alert.alert("Delete category?", `Remove ${category.name}?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => persist({ ...state, categories: state.categories.filter((item) => item.id !== category.id) }) }]); }} hitSlop={8} style={styles.rowIcon}><Ionicons name="trash-outline" size={19} color={colors.error} /></Pressable></View>; })}{deleteTarget ? <View style={styles.transferBox}><Text style={styles.bodyStrong}>Move spends from {deleteTarget.name} to:</Text><CategoryDropdown value={transferId} categories={state.categories.filter((item) => item.id !== deleteTarget.id)} onChange={setTransferId} /><View style={styles.transferActions}><Pressable onPress={() => setDeleteTarget(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable onPress={deleteCategory} style={styles.primarySmallButton}><Text style={styles.primaryButtonText}>Move & delete</Text></Pressable></View></View> : null}</View>;
}

function ExportForm({ state }: { state: LedgerState }) { const { colors } = useTheme(); const styles = useStyles(); const [from, setFrom] = useState(`01/${String(new Date().getMonth() + 1).padStart(2, "0")}/${new Date().getFullYear()}`); const [to, setTo] = useState(todayString()); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const selected = state.payments.filter((item) => dateValue(item.date) >= dateValue(from) && dateValue(item.date) <= dateValue(to)); const total = selected.reduce((sum, item) => sum + item.amount, 0);
  const generate = async () => { if (!dateValue(from) || !dateValue(to) || dateValue(from) > dateValue(to)) { setMessage("Use a valid date range in DD/MM/YYYY format."); return; } setBusy(true); setMessage(""); const rows = selected.map((item) => `<tr><td>${item.date}</td><td>${state.categories.find((category) => category.id === item.categoryId)?.name ?? "Unknown"}</td><td>${item.note || "—"}</td><td style="text-align:right">${money(item.amount)}</td></tr>`).join(""); const html = `<html><body style="font-family:Arial;color:#1A1D20;padding:24px"><h1>Ledger spend report</h1><p>${from} – ${to}</p><h2>${money(total)}</h2><p>${selected.length} payment${selected.length === 1 ? "" : "s"}</p><h3>Payments</h3><table style="width:100%;border-collapse:collapse"><tr><th align="left">Date</th><th align="left">Category</th><th align="left">Note</th><th align="right">Amount</th></tr>${rows}</table><p style="margin-top:40px;color:#6C757D">Made by Subhasish</p></body></html>`; try { const result = await Print.printToFileAsync({ html }); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", dialogTitle: "Share ledger report" }); else setMessage("PDF created, but sharing is not available on this device."); } catch { setMessage("Could not create the PDF. Please try again."); } finally { setBusy(false); } };
  return <View style={styles.sheet}><SheetHeader title="Download PDF" subtitle="Choose any date range for your report" /><Text style={styles.fieldLabel}>From</Text><TextInput value={from} onChangeText={setFrom} keyboardType="numbers-and-punctuation" style={styles.input} placeholder="DD/MM/YYYY" placeholderTextColor={colors.muted} /><Text style={styles.fieldLabel}>To</Text><TextInput value={to} onChangeText={setTo} keyboardType="numbers-and-punctuation" style={styles.input} placeholder="DD/MM/YYYY" placeholderTextColor={colors.muted} /><View style={styles.exportPreview}><Text style={styles.muted}>Report preview</Text><Text style={styles.previewAmount}>{money(total)}</Text><Text style={styles.muted}>{selected.length} payments · summary and itemized list</Text></View>{message ? <Text style={styles.errorText}>{message}</Text> : null}<Pressable onPress={generate} disabled={busy} style={[styles.primaryButton, busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryButtonText}>Generate & share PDF</Text>}</Pressable></View>; }

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.surface }, content: { paddingHorizontal: 20 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }, eyebrow: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: 6 }, title: { color: colors.onSurface, fontSize: 28, fontWeight: "700" }, iconButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }, totalCard: { backgroundColor: colors.brandPrimary, borderRadius: 20, padding: 22, marginBottom: 30 }, totalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, totalLabel: { color: colors.onBrandPrimary, opacity: 0.8, fontSize: 14 }, totalAmount: { color: colors.onBrandPrimary, fontSize: 34, fontWeight: "700", marginTop: 10, marginBottom: 22 }, segmented: { backgroundColor: colors.brandSecondary, borderRadius: 10, flexDirection: "row", padding: 3 }, segment: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 }, segmentActive: { backgroundColor: colors.surfaceSecondary }, segmentText: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "600" }, segmentTextActive: { color: colors.onSurface }, sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }, sectionTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "700", marginBottom: 4 }, muted: { color: colors.muted, fontSize: 13 }, body: { color: colors.onSurfaceSecondary, fontSize: 14 }, bodyStrong: { color: colors.onSurfaceSecondary, fontSize: 15, fontWeight: "600" }, breakdownCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 30 }, breakdownRow: { marginBottom: 14 }, breakdownLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }, breakdownLine: { flexDirection: "row", alignItems: "center", marginBottom: 8 }, dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 }, breakdownLine: { flexDirection: "row", alignItems: "center", marginBottom: 8 }, breakdownLine: { flexDirection: "row", alignItems: "center", marginBottom: 8 }, breakdownLine: { flexDirection: "row", alignItems: "center", marginBottom: 8 }, breakdownLine: { flexDirection: "row", alignItems: "center", marginBottom: 8 }, progressTrack: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 3, overflow: "hidden" }, progress: { height: 6, borderRadius: 3 }, emptyCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: "center", marginBottom: 30, gap: 8 }, emptyTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "700" }, paymentRow: { backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: 14, flexDirection: "row", alignItems: "center" }, paymentIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginRight: 12 }, paymentInfo: { flex: 1 }, paymentRight: { alignItems: "flex-end", gap: 6 }, amount: { color: colors.onSurface, fontSize: 15, fontWeight: "700" }, rowActions: { flexDirection: "row", gap: 14 }, emptyList: { paddingVertical: 24, alignItems: "center" }, footer: { color: colors.muted, textAlign: "center", fontSize: 12, marginTop: 32 }, fab: { position: "absolute", right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: colors.surfaceInverse, shadowOpacity: 0.2, shadowRadius: 8 }, fabPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] }, snackbar: { position: "absolute", left: 20, right: 94, backgroundColor: colors.surfaceInverse, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, snackText: { color: colors.onSurfaceInverse, fontSize: 14 }, undoText: { color: colors.onSurfaceInverse, fontWeight: "700", fontSize: 14 }, pressed: { opacity: 0.75 }, dropdownWrap: { position: "relative", zIndex: 5 }, dropdown: { minHeight: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, dropdownCompact: { minHeight: 44, maxWidth: 142, paddingHorizontal: 10 }, dropdownText: { color: colors.onSurfaceSecondary, fontSize: 13, flex: 1 }, dropdownMenu: { position: "absolute", top: 52, right: 0, minWidth: 170, backgroundColor: colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: colors.border, elevation: 5, shadowColor: colors.surfaceInverse, shadowOpacity: 0.15, shadowRadius: 8, overflow: "hidden" }, dropdownOption: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.divider }, sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, maxHeight: "88%" }, sheetHeader: { paddingBottom: 18, marginBottom: 4 }, sheetTitle: { color: colors.onSurface, fontSize: 23, fontWeight: "700", marginBottom: 5 }, actionRow: { minHeight: 62, borderTopWidth: 1, borderTopColor: colors.divider, flexDirection: "row", alignItems: "center", gap: 12 }, actionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }, fieldLabel: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700", marginTop: 12, marginBottom: 7 }, optional: { color: colors.muted, fontWeight: "400" }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, paddingHorizontal: 14, color: colors.onSurface, backgroundColor: colors.surfaceSecondary, fontSize: 15 }, amountInput: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, paddingHorizontal: 14, minHeight: 62 }, currency: { color: colors.onSurface, fontSize: 28, fontWeight: "700", marginRight: 8 }, amountTextInput: { flex: 1, color: colors.onSurface, fontSize: 28, fontWeight: "700" }, noteInput: { minHeight: 72, paddingTop: 13, textAlignVertical: "top" }, errorText: { color: colors.error, fontSize: 13, marginTop: 10 }, primaryButton: { minHeight: 52, borderRadius: 12, marginTop: 18, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }, primaryButtonText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "700" }, disabled: { opacity: 0.5 }, inlineForm: { flexDirection: "row", gap: 8, marginBottom: 8 }, inlineInput: { flex: 1 }, smallButton: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }, categoryRow: { minHeight: 54, borderTopWidth: 1, borderTopColor: colors.divider, flexDirection: "row", alignItems: "center", gap: 9 }, categoryBullet: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }, categoryBulletText: { color: colors.onBrandTertiary, fontWeight: "700" }, miniBadge: { color: colors.muted, fontSize: 9, fontWeight: "700" }, rowIcon: { width: 36, height: 44, alignItems: "center", justifyContent: "center" }, transferBox: { backgroundColor: colors.surfaceTertiary, borderRadius: 12, padding: 12, marginTop: 12 }, transferActions: { flexDirection: "row", gap: 8, marginTop: 10 }, secondaryButton: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" }, secondaryButtonText: { color: colors.onSurfaceSecondary, fontWeight: "600" }, primarySmallButton: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }, exportPreview: { backgroundColor: colors.surfaceTertiary, borderRadius: 12, padding: 16, marginTop: 18 }, previewAmount: { color: colors.onSurface, fontSize: 24, fontWeight: "700", marginVertical: 5 },
}));
