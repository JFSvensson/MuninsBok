/**
 * Swedish translations for the web application
 */

export const sv = {
  common: {
    loading: "Laddar...",
    save: "Spara",
    cancel: "Avbryt",
    delete: "Ta bort",
    add: "Lägg till",
    close: "Stäng",
    yes: "Ja",
    no: "Nej",
    kr: "kr",
  },
  
  errors: {
    loadFailed: "Fel vid hämtning",
    saveFailed: "Fel vid sparning",
    unknownError: "Ett okänt fel uppstod",
  },
  
  org: {
    selectOrg: "Välj organisation",
    selectFiscalYear: "Välj räkenskapsår",
  },
  
  nav: {
    vouchers: "Verifikat",
    newVoucher: "Nytt verifikat",
    trialBalance: "Råbalans",
    incomeStatement: "Resultaträkning",
    balanceSheet: "Balansräkning",
    sie: "SIE",
  },
  
  voucher: {
    title: "Verifikat",
    create: "Nytt verifikat",
    save: "Spara verifikat",
    saving: "Sparar...",
    date: "Datum",
    description: "Beskrivning",
    descriptionPlaceholder: "T.ex. Kontantförsäljning",
    account: "Konto",
    selectAccount: "Välj konto",
    debit: "Debet",
    credit: "Kredit",
    optional: "Valfri",
    addLine: "+ Lägg till rad",
    balanced: "✓ Balanserar",
    difference: "Differens",
    amount: "Belopp",
    number: "Nr",
    noVouchers: "Inga verifikat ännu. Skapa ditt första verifikat!",
    minTwoLines: "Verifikatet måste ha minst två rader",
  },
  
  reports: {
    trialBalance: "Råbalans",
    incomeStatement: "Resultaträkning",
    balanceSheet: "Balansräkning",
    accountNumber: "Konto",
    accountName: "Namn",
    balance: "Saldo",
    total: "Summa",
    noTransactions: "Inga bokförda transaktioner ännu.",
    
    // Income statement
    revenues: "Intäkter",
    expenses: "Kostnader",
    operatingResult: "Rörelseresultat",
    financialIncome: "Finansiella intäkter",
    financialExpenses: "Finansiella kostnader",
    netResult: "Årets resultat",
    
    // Balance sheet
    assets: "Tillgångar",
    liabilities: "Skulder",
    equity: "Eget kapital",
    yearResult: "Årets resultat",
    totalAssets: "Summa tillgångar",
    totalLiabilitiesAndEquity: "Summa eget kapital och skulder",
    balanceWarning: "Varning: Balansräkningen balanserar inte!",
  },
  
  sie: {
    title: "SIE Import/Export",
    description: "SIE är ett standardformat för att utbyta bokföringsdata mellan olika program.",
    export: "Exportera",
    exportDescription: "Ladda ner bokföringen som en SIE4-fil för att använda i andra program eller för revision.",
    download: "Ladda ner SIE-fil",
    import: "Importera",
    importDescription: "Importera verifikat från en SIE-fil. Appen stöder SIE4-format.",
    importing: "Importerar...",
    importSuccess: "Import lyckades!",
    vouchersImported: "verifikat",
    accountsImported: "konton importerades",
  },
} as const;

export type Translations = typeof sv;
