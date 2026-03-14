/**
 * Internationalization module — flat key-value dictionaries for all UI strings.
 * Supports Swedish (sv) and English (en).
 */

export type Locale = "sv" | "en";

export const DEFAULT_LOCALE: Locale = "sv";

export const SUPPORTED_LOCALES: readonly Locale[] = ["sv", "en"] as const;

export type TranslationKey = keyof typeof sv;

// ── Swedish (default) ───────────────────────────────────────

const sv = {
  // Common
  "common.loading": "Laddar…",
  "common.save": "Spara",
  "common.cancel": "Avbryt",
  "common.delete": "Ta bort",
  "common.edit": "Redigera",
  "common.create": "Skapa",
  "common.yes": "Ja",
  "common.no": "Nej",
  "common.back": "Tillbaka",
  "common.close": "Stäng",
  "common.search": "Sök",
  "common.noResults": "Inga resultat",
  "common.error": "Ett fel uppstod",
  "common.required": "Obligatoriskt fält",
  "common.optional": "Valfritt",

  // Nav
  "nav.dashboard": "Översikt",
  "nav.vouchers": "Verifikat",
  "nav.accounts": "Kontoplan",
  "nav.templates": "Mallar",
  "nav.budgets": "Budget",
  "nav.reports": "Rapporter",
  "nav.trialBalance": "Huvudbok",
  "nav.balanceSheet": "Balansräkning",
  "nav.incomeStatement": "Resultaträkning",
  "nav.vatReport": "Momsrapport",
  "nav.sieExport": "SIE-export",
  "nav.csvImport": "CSV-import",
  "nav.fiscalYears": "Räkenskapsår",
  "nav.yearEndClosing": "Årsbokslut",
  "nav.members": "Medlemmar",
  "nav.approval": "Attestering",
  "nav.settings": "Inställningar",
  "nav.logout": "Logga ut",
  "nav.login": "Logga in",
  "nav.register": "Registrera",
  "nav.searchPlaceholder": "Sök verifikat, konton…",
  "nav.language": "Språk",

  // Dashboard
  "dashboard.title": "Översikt",
  "dashboard.revenue": "Intäkter",
  "dashboard.expenses": "Kostnader",
  "dashboard.result": "Resultat",
  "dashboard.assets": "Tillgångar",
  "dashboard.liabilities": "Skulder",
  "dashboard.equity": "Eget kapital",
  "dashboard.recentVouchers": "Senaste verifikat",
  "dashboard.trends": "Trendlinjer",
  "dashboard.forecast": "Prognos",
  "dashboard.comparison": "Årsjämförelse",

  // Vouchers
  "vouchers.title": "Verifikat",
  "vouchers.new": "+ Nytt verifikat",
  "vouchers.number": "Verifikatnr",
  "vouchers.date": "Datum",
  "vouchers.description": "Beskrivning",
  "vouchers.amount": "Belopp (kr)",
  "vouchers.create.title": "Nytt verifikat",
  "vouchers.create.addLine": "+ Lägg till rad",
  "vouchers.create.account": "Konto",
  "vouchers.create.debit": "Debet (kr)",
  "vouchers.create.credit": "Kredit (kr)",
  "vouchers.create.balanced": "✓ Balanserar",
  "vouchers.create.difference": "Differens",
  "vouchers.create.submit": "Skapa verifikat",
  "vouchers.detail.title": "Verifikat",
  "vouchers.detail.correction": "Skapa rättelseverifikat",
  "vouchers.list.empty": "Inga verifikat hittades",

  // Templates
  "templates.title": "Verifikatmallar",
  "templates.new": "+ Ny mall",
  "templates.empty":
    "Inga mallar ännu. Skapa en mall för att snabbt fylla i återkommande verifikat.",
  "templates.name": "Namn",
  "templates.description": "Beskrivning",
  "templates.schedule": "Schema",
  "templates.lines": "Rader",
  "templates.amount": "Belopp (kr)",
  "templates.form.title.new": "Ny verifikatmall",
  "templates.form.title.edit": "Redigera mall",
  "templates.form.name": "Mallnamn",
  "templates.form.namePlaceholder": "T.ex. Månadshyra",
  "templates.form.description": "Beskrivning (valfri)",
  "templates.form.descPlaceholder": "T.ex. Hyra kontor Storgatan 1",
  "templates.form.submit.create": "Skapa mall",
  "templates.form.submit.edit": "Spara ändringar",
  "templates.form.saving": "Sparar...",
  "templates.form.errorName": "Mallnamn krävs",
  "templates.form.errorLine": "Mallen måste ha minst en rad med konto och belopp",
  "templates.form.errorDualEntry": "En rad kan inte ha både debet och kredit",
  "templates.recurring.title": "Schemaläggning",
  "templates.recurring.enabled": "Återkommande mall",
  "templates.recurring.frequency": "Frekvens",
  "templates.recurring.monthly": "Månadsvis",
  "templates.recurring.quarterly": "Kvartalsvis",
  "templates.recurring.dayOfMonth": "Dag i månaden",
  "templates.recurring.endDate": "Slutdatum (valfritt)",
  "templates.recurring.save": "Spara schemaläggning",
  "templates.recurring.execute": "Kör schemalagda",
  "templates.recurring.due": "förfallna och redo att köras.",
  "templates.recurring.run": "Kör nu",
  "templates.recurring.running": "Kör...",
  "templates.recurring.selectFy": "Välj räkenskapsår",
  "templates.recurring.updated": "Schemaläggning uppdaterad",
  "templates.recurring.monthLabel": "Månad",
  "templates.recurring.quarterLabel": "Kvartal",
  "templates.deleted": "Mallen har tagits bort",
  "templates.deleteError": "Kunde inte ta bort mallen",
  "templates.created": "Mallen har skapats",
  "templates.updated": "Mallen har uppdaterats",
  "templates.deleteConfirm": "Ta bort?",
  "templates.executeError": "Kunde inte köra schemalagda mallar",
  "templates.vouchersCreated": "verifikat skapade",
  "templates.executeErrors": "fel vid körning",

  // Accounts
  "accounts.title": "Kontoplan",
  "accounts.number": "Konto",
  "accounts.name": "Namn",
  "accounts.type": "Typ",
  "accounts.active": "Aktiv",

  // Fiscal years
  "fiscalYears.title": "Räkenskapsår",
  "fiscalYears.startDate": "Startdatum",
  "fiscalYears.endDate": "Slutdatum",
  "fiscalYears.status": "Status",
  "fiscalYears.open": "Öppet",
  "fiscalYears.closed": "Stängt",
  "fiscalYears.new": "Nytt räkenskapsår",

  // Reports
  "reports.trialBalance": "Huvudbok",
  "reports.balanceSheet": "Balansräkning",
  "reports.incomeStatement": "Resultaträkning",
  "reports.generalLedger": "Huvudbok",
  "reports.journalReport": "Grundbok",
  "reports.voucherList": "Verifikatlista",
  "reports.period": "Period",
  "reports.exportPdf": "Exportera PDF",

  // CSV Import
  "csvImport.title": "Importera bankutdrag (CSV)",
  "csvImport.step1": "Ladda upp",
  "csvImport.step2": "Kolumnmappning",
  "csvImport.step3": "Förhandsgranska",
  "csvImport.step4": "Resultat",

  // Auth
  "auth.login": "Logga in",
  "auth.register": "Registrera",
  "auth.email": "E-post",
  "auth.password": "Lösenord",
  "auth.name": "Namn",
  "auth.noAccount": "Har du inget konto?",
  "auth.hasAccount": "Har du redan ett konto?",

  // Organization
  "org.select": "Välj organisation",
  "org.create": "Skapa organisation",
  "org.name": "Organisationsnamn",
  "org.number": "Organisationsnummer",

  // Budget
  "budget.title": "Budget",
  "budget.new": "Ny budget",

  // Members
  "members.title": "Medlemmar",
  "members.role": "Roll",
  "members.invite": "Bjud in",

  // Approval
  "approval.title": "Attestering",
  "approval.rules": "Attestregler",
  "approval.pending": "Väntande attester",
  "approval.newRule": "Ny attestregel",
  "approval.editRule": "Redigera attestregel",
  "approval.ruleName": "Regelnamn",
  "approval.minAmount": "Minsta belopp (kr)",
  "approval.maxAmount": "Högsta belopp (kr)",
  "approval.noMaxAmount": "Inget tak",
  "approval.requiredRole": "Roll som krävs",
  "approval.stepOrder": "Stegordning",
  "approval.submit": "Skicka för attestering",
  "approval.approve": "Godkänn",
  "approval.reject": "Avvisa",
  "approval.comment": "Kommentar",
  "approval.noRules": "Inga attestregler har skapats.",
  "approval.noPending": "Inga väntande attester.",
  "approval.statusDraft": "Utkast",
  "approval.statusPending": "Väntar på attest",
  "approval.statusApproved": "Godkänd",
  "approval.statusRejected": "Avvisad",
  "approval.autoApproved": "Automatiskt godkänd (inga matchande regler)",
  "approval.step": "Steg",
  "approval.decidedBy": "Beslutad av",
  "approval.deleteConfirm": "Vill du ta bort denna attestregel?",

  // Not found
  "notFound.title": "Sidan hittades inte",
  "notFound.message": "Sidan du söker finns inte.",
  "notFound.back": "Tillbaka till översikten",
} as const;

// ── English ─────────────────────────────────────────────────

const en: Record<TranslationKey, string> = {
  // Common
  "common.loading": "Loading…",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.create": "Create",
  "common.yes": "Yes",
  "common.no": "No",
  "common.back": "Back",
  "common.close": "Close",
  "common.search": "Search",
  "common.noResults": "No results",
  "common.error": "An error occurred",
  "common.required": "Required field",
  "common.optional": "Optional",

  // Nav
  "nav.dashboard": "Dashboard",
  "nav.vouchers": "Vouchers",
  "nav.accounts": "Chart of Accounts",
  "nav.templates": "Templates",
  "nav.budgets": "Budgets",
  "nav.reports": "Reports",
  "nav.trialBalance": "Trial Balance",
  "nav.balanceSheet": "Balance Sheet",
  "nav.incomeStatement": "Income Statement",
  "nav.vatReport": "VAT Report",
  "nav.sieExport": "SIE Export",
  "nav.csvImport": "CSV Import",
  "nav.fiscalYears": "Fiscal Years",
  "nav.yearEndClosing": "Year-End Closing",
  "nav.members": "Members",
  "nav.approval": "Approvals",
  "nav.settings": "Settings",
  "nav.logout": "Log out",
  "nav.login": "Log in",
  "nav.register": "Register",
  "nav.searchPlaceholder": "Search vouchers, accounts…",
  "nav.language": "Language",

  // Dashboard
  "dashboard.title": "Dashboard",
  "dashboard.revenue": "Revenue",
  "dashboard.expenses": "Expenses",
  "dashboard.result": "Result",
  "dashboard.assets": "Assets",
  "dashboard.liabilities": "Liabilities",
  "dashboard.equity": "Equity",
  "dashboard.recentVouchers": "Recent Vouchers",
  "dashboard.trends": "Trends",
  "dashboard.forecast": "Forecast",
  "dashboard.comparison": "Year Comparison",

  // Vouchers
  "vouchers.title": "Vouchers",
  "vouchers.new": "+ New Voucher",
  "vouchers.number": "Voucher No",
  "vouchers.date": "Date",
  "vouchers.description": "Description",
  "vouchers.amount": "Amount",
  "vouchers.create.title": "New Voucher",
  "vouchers.create.addLine": "+ Add line",
  "vouchers.create.account": "Account",
  "vouchers.create.debit": "Debit",
  "vouchers.create.credit": "Credit",
  "vouchers.create.balanced": "✓ Balanced",
  "vouchers.create.difference": "Difference",
  "vouchers.create.submit": "Create Voucher",
  "vouchers.detail.title": "Voucher",
  "vouchers.detail.correction": "Create correction voucher",
  "vouchers.list.empty": "No vouchers found",

  // Templates
  "templates.title": "Voucher Templates",
  "templates.new": "+ New Template",
  "templates.empty": "No templates yet. Create a template for quick entry of recurring vouchers.",
  "templates.name": "Name",
  "templates.description": "Description",
  "templates.schedule": "Schedule",
  "templates.lines": "Lines",
  "templates.amount": "Amount",
  "templates.form.title.new": "New Voucher Template",
  "templates.form.title.edit": "Edit Template",
  "templates.form.name": "Template name",
  "templates.form.namePlaceholder": "E.g. Monthly rent",
  "templates.form.description": "Description (optional)",
  "templates.form.descPlaceholder": "E.g. Office rent Main St. 1",
  "templates.form.submit.create": "Create Template",
  "templates.form.submit.edit": "Save Changes",
  "templates.form.saving": "Saving...",
  "templates.form.errorName": "Template name is required",
  "templates.form.errorLine": "Template must have at least one line with account and amount",
  "templates.form.errorDualEntry": "A line cannot have both debit and credit",
  "templates.recurring.title": "Scheduling",
  "templates.recurring.enabled": "Recurring template",
  "templates.recurring.frequency": "Frequency",
  "templates.recurring.monthly": "Monthly",
  "templates.recurring.quarterly": "Quarterly",
  "templates.recurring.dayOfMonth": "Day of month",
  "templates.recurring.endDate": "End date (optional)",
  "templates.recurring.save": "Save schedule",
  "templates.recurring.execute": "Run scheduled",
  "templates.recurring.due": "due and ready to run.",
  "templates.recurring.run": "Run now",
  "templates.recurring.running": "Running...",
  "templates.recurring.selectFy": "Select fiscal year",
  "templates.recurring.updated": "Schedule updated",
  "templates.recurring.monthLabel": "Month",
  "templates.recurring.quarterLabel": "Quarter",
  "templates.deleted": "Template deleted",
  "templates.deleteError": "Could not delete template",
  "templates.created": "Template created",
  "templates.updated": "Template updated",
  "templates.deleteConfirm": "Delete?",
  "templates.executeError": "Could not run scheduled templates",
  "templates.vouchersCreated": "vouchers created",
  "templates.executeErrors": "errors during execution",

  // Accounts
  "accounts.title": "Chart of Accounts",
  "accounts.number": "Account",
  "accounts.name": "Name",
  "accounts.type": "Type",
  "accounts.active": "Active",

  // Fiscal years
  "fiscalYears.title": "Fiscal Years",
  "fiscalYears.startDate": "Start Date",
  "fiscalYears.endDate": "End Date",
  "fiscalYears.status": "Status",
  "fiscalYears.open": "Open",
  "fiscalYears.closed": "Closed",
  "fiscalYears.new": "New Fiscal Year",

  // Reports
  "reports.trialBalance": "Trial Balance",
  "reports.balanceSheet": "Balance Sheet",
  "reports.incomeStatement": "Income Statement",
  "reports.generalLedger": "General Ledger",
  "reports.journalReport": "Journal",
  "reports.voucherList": "Voucher List",
  "reports.period": "Period",
  "reports.exportPdf": "Export PDF",

  // CSV Import
  "csvImport.title": "Import Bank Statement (CSV)",
  "csvImport.step1": "Upload",
  "csvImport.step2": "Column Mapping",
  "csvImport.step3": "Preview",
  "csvImport.step4": "Result",

  // Auth
  "auth.login": "Log in",
  "auth.register": "Register",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.name": "Name",
  "auth.noAccount": "Don't have an account?",
  "auth.hasAccount": "Already have an account?",

  // Organization
  "org.select": "Select organization",
  "org.create": "Create organization",
  "org.name": "Organization name",
  "org.number": "Organization number",

  // Budget
  "budget.title": "Budgets",
  "budget.new": "New Budget",

  // Members
  "members.title": "Members",
  "members.role": "Role",
  "members.invite": "Invite",

  // Approval
  "approval.title": "Approvals",
  "approval.rules": "Approval Rules",
  "approval.pending": "Pending Approvals",
  "approval.newRule": "New Approval Rule",
  "approval.editRule": "Edit Approval Rule",
  "approval.ruleName": "Rule Name",
  "approval.minAmount": "Minimum Amount (kr)",
  "approval.maxAmount": "Maximum Amount (kr)",
  "approval.noMaxAmount": "No limit",
  "approval.requiredRole": "Required Role",
  "approval.stepOrder": "Step Order",
  "approval.submit": "Submit for Approval",
  "approval.approve": "Approve",
  "approval.reject": "Reject",
  "approval.comment": "Comment",
  "approval.noRules": "No approval rules have been created.",
  "approval.noPending": "No pending approvals.",
  "approval.statusDraft": "Draft",
  "approval.statusPending": "Pending Approval",
  "approval.statusApproved": "Approved",
  "approval.statusRejected": "Rejected",
  "approval.autoApproved": "Auto-approved (no matching rules)",
  "approval.step": "Step",
  "approval.decidedBy": "Decided by",
  "approval.deleteConfirm": "Do you want to delete this approval rule?",

  // Not found
  "notFound.title": "Page not found",
  "notFound.message": "The page you are looking for does not exist.",
  "notFound.back": "Back to dashboard",
};

// ── Translation access ──────────────────────────────────────

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { sv, en };

/**
 * Get a translation string for a given key and locale.
 * Falls back to Swedish if the key is missing in the requested locale.
 */
export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale]?.[key] ?? sv[key];
}

/**
 * Create a translation function bound to a specific locale.
 */
export function createTranslator(locale: Locale): (key: TranslationKey) => string {
  return (key) => translate(locale, key);
}
